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
		self.logEl = E('pre', { style: 'max-height:18em;overflow:auto;display:none;margin-top:1em' });
		self.fill(apps);

		const token = E('input', {
			type: 'password', autocomplete: 'new-password',
			class: 'cbi-input-password',
			style: 'width:100%;max-width:26em;box-sizing:border-box',
			placeholder: cfg.token_set ? '•••••• (задан, введите новый для замены)' : 'ghp_… (необязательно)'
		});
		const interval = E('input', {
			type: 'number',
			min: 0,
			style: 'width:6em;box-sizing:border-box',
			value: cfg.interval || 24
		});
		const auto = E('input', Object.assign({
			type: 'checkbox',
			style: 'margin:0;position:static'
		}, cfg.auto === '1' ? { checked: 'checked' } : {}));

		const repo = E('input', {
			type: 'text',
			style: 'flex:1 1 220px;min-width:0;max-width:100%;box-sizing:border-box',
			placeholder: 'owner/repo или URL GitHub'
		});
		const pre = E('input', {
			type: 'checkbox',
			style: 'margin:0;position:static'
		});

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
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, 'GitHub API token'),
					E('div', { class: 'cbi-value-field', style: 'width:100%' }, token)
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, 'Проверка каждые N ч (0 — выкл.)'),
					E('div', { class: 'cbi-value-field' }, interval)
				]),
				E('div', { class: 'cbi-value' }, [
					E('label', { class: 'cbi-value-title' }, 'Автообновление'),
					E('div', { class: 'cbi-value-field' },
						E('label', { style: 'display:inline-flex;align-items:center;gap:8px;cursor:pointer;margin:0;padding:4px 0;position:static' }, [
							auto,
							E('span', {}, 'Включено')
						])
					)
				]),
				E('div', { style: 'margin-top:.8em;display:flex;flex-wrap:wrap;gap:8px' }, [
					E('button', {
						class: 'btn cbi-button-save',
						click: () => Promise.all([
							token.value ? sh('set', 'token', token.value) : null,
							sh('set', 'interval', String(parseInt(interval.value) || 0)),
							sh('set', 'auto', b(auto.checked))
						]).then(() => { token.value = ''; note('Сохранено'); })
					}, 'Сохранить'),
					cfg.token_set ? E('button', {
						class: 'btn cbi-button-remove',
						click: () => sh('set', 'token', '').then(() => note('Токен удалён'))
					}, 'Удалить токен') : ''
				])
			]),

			E('div', { class: 'cbi-section' }, [
				E('h3', {}, 'Добавить репозиторий'),
				E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:10px' }, [
					repo,
					E('label', { style: 'display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:0;white-space:nowrap;position:static' }, [
						pre,
						E('span', {}, 'pre-release')
					]),
					E('button', {
						class: 'btn cbi-button-add',
						style: 'white-space:nowrap',
						click: () => {
							if (!repo.value.trim()) return;
							self.pick({ repo: repo.value.trim(), pre: pre.checked, pattern: '' }, p =>
								sh('add', repo.value.trim(), b(pre.checked), p).then(r => {
									if (r === 'ok') { repo.value = ''; self.refresh(); } else note(r, 'danger');
								}));
						}
					}, 'Выбрать сборки…')
				])
			]),

			E('div', { class: 'cbi-section' }, [
				E('h3', {}, 'Приложения'),
				E('div', { style: 'margin-bottom:.8em;display:flex;flex-wrap:wrap;gap:8px' }, [
					E('button', { class: 'btn cbi-button', click: () => self.bg('check') }, 'Проверить'),
					E('button', { class: 'btn cbi-button-action', click: () => self.bg('update') }, 'Обновить все')
				]),
				E('div', { style: 'overflow-x:auto;width:100%;-webkit-overflow-scrolling:touch' }, [
					E('table', { class: 'table', style: 'min-width:520px;width:100%;table-layout:auto' }, [
						E('thead', {}, E('tr', { class: 'tr table-titles' },
							['Репозиторий', 'Установлено', 'Последняя', 'Фильтр', ''].map(t =>
								E('th', { class: 'th', style: 'white-space:nowrap' }, t)
							)
						)),
						self.tbody
					])
				]),
				self.logEl
			])
		]);
	},

	fill(apps) {
		const tdStyle = 'white-space:nowrap;vertical-align:middle';
		dom.content(this.tbody, apps.length ? apps.map(a => {
			const old = a.latest && a.installed !== a.latest;
			return E('tr', { class: 'tr' }, [
				E('td', { class: 'td', style: tdStyle }, E('a', { href: 'https://github.com/' + a.repo, target: '_blank' },
					a.repo + (a.pre ? ' (pre)' : ''))),
				E('td', { class: 'td', style: tdStyle }, a.installed || '—'),
				E('td', { class: 'td', style: tdStyle + (old ? ';font-weight:bold;color:#e67e00' : '') }, a.latest || '—'),
				E('td', { class: 'td', style: tdStyle }, E('code', {}, a.pattern || '(все)')),
				E('td', { class: 'td', style: tdStyle }, [
					E('div', { style: 'display:inline-flex;gap:6px;flex-wrap:nowrap' }, [
						E('button', { class: 'btn cbi-button', click: () => this.pick(a, p =>
							sh('edit', a.id, b(a.pre), p).then(() => this.refresh())) }, 'Сборки'),
						E('button', { class: 'btn cbi-button-action', click: () => this.bg('install', a.id) }, 'Установить'),
						E('button', { class: 'btn cbi-button-remove', click: () =>
							sh('del', a.id).then(() => this.refresh()) }, 'Удалить')
					])
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
				const cb = E('input', Object.assign({
					type: 'checkbox',
					style: 'margin:0;position:static'
				}, a.selected ? { checked: 'checked' } : {}));
				return {
					a,
					cb,
					el: E('label', { style: 'display:flex;align-items:center;gap:8px;margin:.4em 0;cursor:pointer;position:static' }, [cb, E('span', { style: 'word-break:break-all' }, a.name)])
				};
			});
			ui.showModal(`${app.repo} · ${r.tag}`, [
				E('p', {}, `Показаны только .${r.ext}` + (r.hidden ? `, скрыто чужих архитектур: ${r.hidden}` : '')),
				E('div', { style: 'max-height:50vh;overflow:auto' },
					rows.length ? rows.map(x => x.el) : E('em', {}, `В релизе нет подходящих .${r.ext}`)),
				E('div', { class: 'right', style: 'margin-top:1em;display:flex;justify-content:flex-end;gap:8px' }, [
					E('button', { class: 'btn', click: ui.hideModal }, 'Отмена'),
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
