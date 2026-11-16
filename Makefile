include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Obtainium - install/update packages from GitHub releases
LUCI_DEPENDS:=+curl +ca-bundle +jsonfilter
LUCI_PKGARCH:=all
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
