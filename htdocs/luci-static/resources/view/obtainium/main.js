'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require poll';

const BIN = '/usr/bin/obtainium';
const sh = (...a) => fs.exec_direct(BIN, a, 'text').then(t => (t || '').trim());
const js = (...a) => sh(...a).then(JSON.parse);
const b = v => v ? '1' : '0';
const note = (m, t) => ui.addNotification(null, E('p', m), t || 'info');

return view.extend({
	load: () => Promise.all([js('cfg'), js('list')]),

	render([cfg, apps]) {
		const self = this;
		self.tbody = E('tbody');
		self.logEl = E('pre', { style: 'max-height:18em;overflow:auto;display:none' });
		self.fill(apps);

		const token = E('input', { type: 'password', class: 'cbi-input-password', style: 'width:22em',
			placeholder: cfg.token_set ? '•••••• (задан, введите новый для замены)' : 'ghp_… (необязательно)' });
		const interval = E('input', { type: 'number', min: 0, style: 'width:5em', value: cfg.interval || 24 });
		const auto = E('input', Object.assign({ type: 'checkbox' }, cfg.auto === '1' ? { checked: 'checked' } : {}));

		const repo = E('input', { type: 'text', style: 'width:22em', placeholder: 'owner/repo или URL GitHub' });
		const pre = E('input', { type: 'checkbox' });

		poll.add(() => Promise.all([sh('running'), sh('log')]).then(([r, l]) => {
			if (l) { self.logEl.style.display = ''; self.logEl.textContent = l; }
			if (self.was === '1' && r === '0') self.refresh();
			self.was = r;
		}), 2);

		return E('div', { class: 'cbi-map' }, [
			E('h2', {}, 'Obtainium'),
			E('div', { class: 'cbi-map-descr' },
				`OpenWrt ${cfg.rel} · менеджер: ${cfg.pm} (.${cfg.ext}) · arch: ${cfg.arch}`),

			E('div', { class: 'cbi-section' }, [
				E('h3', {}, 'Настройки'),
				E('div', { class: 'cbi-value' }, [E('label', { class: 'cbi-value-title' }, 'GitHub API token'),
					E('div', { class: 'cbi-value-field' }, token)]),
				E('div', { class: 'cbi-value' }, [E('label', { class: 'cbi-value-title' }, 'Проверка каждые N ч (0 — выкл.)'),
					E('div', { class: 'cbi-value-field' }, interval)]),
				E('div', { class: 'cbi-value' }, [E('label', { class: 'cbi-value-title' }, 'Автообновление'),
					E('div', { class: 'cbi-value-field' }, auto)]),
				E('button', { class: 'btn cbi-button-save', click: () => Promise.all([
					token.value ? sh('set', 'token', token.value) : null,
					sh('set', 'interval', String(parseInt(interval.value) || 0)),
					sh('set', 'auto', b(auto.checked))
				]).then(() => { token.value = ''; note('Сохранено'); }) }, 'Сохранить'), ' ',
				cfg.token_set ? E('button', { class: 'btn cbi-button-remove',
					click: () => sh('set', 'token', '').then(() => note('Токен удалён')) }, 'Удалить токен') : ''
			]),

			E('div', { class: 'cbi-section' }, [
				E('h3', {}, 'Добавить репозиторий'),
				repo, ' ', E('label', {}, [pre, ' pre-release']), ' ',
				E('button', { class: 'btn cbi-button-add', click: () => {
					if (!repo.value.trim()) return;
					self.pick({ repo: repo.value.trim(), pre: pre.checked, pattern: '' }, p =>
						sh('add', repo.value.trim(), b(pre.checked), p).then(r => {
							if (r === 'ok') { repo.value = ''; self.refresh(); } else note(r, 'danger');
						}));
				} }, 'Выбрать сборки…')
			]),

			E('div', { class: 'cbi-section' }, [
				E('h3', {}, 'Приложения'),
				E('div', { style: 'margin-bottom:.5em' }, [
					E('button', { class: 'btn cbi-button', click: () => self.bg('check') }, 'Проверить'), ' ',
					E('button', { class: 'btn cbi-button-action', click: () => self.bg('update') }, 'Обновить все')
				]),
				E('table', { class: 'table' }, [
					E('thead', {}, E('tr', { class: 'tr table-titles' },
						['Репозиторий', 'Установлено', 'Последняя', 'Фильтр', ''].map(t => E('th', { class: 'th' }, t)))),
					self.tbody
				]),
				self.logEl
			])
		]);
	},

	fill(apps) {
		dom.content(this.tbody, apps.length ? apps.map(a => {
			const old = a.latest && a.installed !== a.latest;
			return E('tr', { class: 'tr' }, [
				E('td', { class: 'td' }, E('a', { href: 'https://github.com/' + a.repo, target: '_blank' },
					a.repo + (a.pre ? ' (pre)' : ''))),
				E('td', { class: 'td' }, a.installed || '—'),
				E('td', { class: 'td', style: old ? 'font-weight:bold;color:#e67e00' : '' }, a.latest || '—'),
				E('td', { class: 'td' }, E('code', {}, a.pattern || '(все)')),
				E('td', { class: 'td' }, [
					E('button', { class: 'btn cbi-button', click: () => this.pick(a, p =>
						sh('edit', a.id, b(a.pre), p).then(() => this.refresh())) }, 'Сборки'), ' ',
					E('button', { class: 'btn cbi-button-action', click: () => this.bg('install', a.id) }, 'Установить'), ' ',
					E('button', { class: 'btn cbi-button-remove', click: () =>
						sh('del', a.id).then(() => this.refresh()) }, 'Удалить')
				])
			]);
		}) : E('tr', { class: 'tr' }, E('td', { class: 'td', colspan: 5 }, E('em', {}, 'Список пуст'))));
	},

	refresh() { return js('list').then(a => this.fill(a)); },

	bg(...args) {
		return sh('bg', ...args).then(r => {
			if (r === 'busy') return note('Уже выполняется другая задача', 'warning');
			this.was = '1';
			this.logEl.style.display = '';
			this.logEl.textContent = '…';
		});
	},

	pick(app, onSave) {
		ui.showModal(app.repo, [E('p', { class: 'spinning' }, 'Загрузка списка сборок…')]);
		js('assets', app.repo, b(app.pre), app.pattern || '').then(r => {
			if (r.error) throw new Error(r.error);
			const rows = r.assets.map(a => {
				const cb = E('input', Object.assign({ type: 'checkbox' }, a.selected ? { checked: 'checked' } : {}));
				return { a, cb, el: E('label', { style: 'display:block;margin:.3em 0' }, [cb, ' ' + a.name]) };
			});
			ui.showModal(`${app.repo} · ${r.tag}`, [
				E('p', {}, `Показаны только .${r.ext}` + (r.hidden ? `, скрыто чужих архитектур: ${r.hidden}` : '')),
				E('div', { style: 'max-height:50vh;overflow:auto' },
					rows.length ? rows.map(x => x.el) : E('em', {}, `В релизе нет подходящих .${r.ext}`)),
				E('div', { class: 'right', style: 'margin-top:1em' }, [
					E('button', { class: 'btn', click: ui.hideModal }, 'Отмена'), ' ',
					E('button', { class: 'btn cbi-button-positive', click: () => {
						const p = rows.filter(x => x.cb.checked).map(x => x.a.suggest).join('|');
						ui.hideModal();
						if (onSave) onSave(p);
					} }, 'OK')
				])
			]);
		}).catch(e => { ui.hideModal(); note(e.message, 'danger'); });
	},

	handleSave: null, handleSaveApply: null, handleReset: null
});
