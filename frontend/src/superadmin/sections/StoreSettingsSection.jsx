import React, { useState, useEffect } from "react";
import { Settings, Save, CheckCircle, RefreshCw, DollarSign, Truck, Mail } from "lucide-react";
import { api } from "../../api";

export default function StoreSettingsSection() {
  const [settings, setSettings] = useState({
    storeName: "Aurélie Fine Jewellery",
    supportEmail: "concierge@aurelie.com",
    contactPhone: "+1 (800) 456-7890",
    currency: "USD",
    currencySymbol: "$",
    freeShippingThreshold: 100,
    standardShippingFee: 15,
    taxPercentage: 8.5,
    returnWindowDays: 30,
    enableTryOn: true,
    enableGuestCheckout: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    api
      .adminGetSettings()
      .then((res) => {
        if (res) setSettings(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, val) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(false);
    try {
      await api.adminUpdateSettings({
        storeName: settings.storeName,
        supportEmail: settings.supportEmail,
        contactPhone: settings.contactPhone,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
        freeShippingThreshold: Number(settings.freeShippingThreshold),
        standardShippingFee: Number(settings.standardShippingFee),
        taxPercentage: Number(settings.taxPercentage),
        returnWindowDays: Number(settings.returnWindowDays),
        enableTryOn: Boolean(settings.enableTryOn),
        enableGuestCheckout: Boolean(settings.enableGuestCheckout),
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
        <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading store settings from database...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
          Store Settings & Global Economics
        </h2>
        <p className="text-[13px] text-textSecondary mt-0.5">
          Configure site-wide storefront branding, currency, shipping fees, tax rates, and return policies.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[13px] flex items-center gap-2">
          <CheckCircle size={15} /> Store settings updated and persisted in PostgreSQL SiteSetting.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Brand Information */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
          <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border">
            Storefront Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Storefront Brand Name *
              </label>
              <input
                type="text"
                required
                value={settings.storeName}
                onChange={(e) => handleChange("storeName", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Concierge Support Email *
              </label>
              <input
                type="email"
                required
                value={settings.supportEmail}
                onChange={(e) => handleChange("supportEmail", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Customer Care Phone
              </label>
              <input
                type="text"
                value={settings.contactPhone}
                onChange={(e) => handleChange("contactPhone", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Default Currency Code
              </label>
              <input
                type="text"
                value={settings.currency}
                onChange={(e) => handleChange("currency", e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark font-mono"
              />
            </div>
          </div>
        </div>

        {/* Shipping & Economics */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
          <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border flex items-center gap-2">
            <Truck size={16} className="text-primaryDark" /> Shipping & Fulfillment Economics
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Free Shipping Threshold ($)
              </label>
              <input
                type="number"
                min="0"
                value={settings.freeShippingThreshold}
                onChange={(e) => handleChange("freeShippingThreshold", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark font-semibold"
              />
              <p className="text-[11px] text-textSecondary mt-1">Orders above this amount qualify for free shipping</p>
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Standard Shipping Fee ($)
              </label>
              <input
                type="number"
                min="0"
                value={settings.standardShippingFee}
                onChange={(e) => handleChange("standardShippingFee", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark font-semibold"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Tax Percentage (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings.taxPercentage}
                onChange={(e) => handleChange("taxPercentage", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none focus:border-primaryDark"
              />
            </div>
          </div>
        </div>

        {/* Policies & Features */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
          <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border">
            Store Policies & Feature Flags
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Return Window (Days)
              </label>
              <input
                type="number"
                min="0"
                value={settings.returnWindowDays}
                onChange={(e) => handleChange("returnWindowDays", e.target.value)}
                className="w-full px-3.5 py-2 border border-border rounded-lg outline-none"
              />
            </div>

            <div className="flex flex-col justify-center space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.enableTryOn}
                  onChange={(e) => handleChange("enableTryOn", e.target.checked)}
                  className="w-4 h-4 accent-primaryDark"
                />
                <span>Enable Virtual Try-On across store</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={settings.enableGuestCheckout}
                  onChange={(e) => handleChange("enableGuestCheckout", e.target.checked)}
                  className="w-4 h-4 accent-primaryDark"
                />
                <span>Allow guest checkout without login</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Store Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
