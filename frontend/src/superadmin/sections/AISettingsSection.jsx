import React, { useState, useEffect } from "react";
import { Sparkles, Save, CheckCircle, RefreshCw, Sliders, Shield } from "lucide-react";
import { api } from "../../api";

export default function AISettingsSection() {
  const [settings, setSettings] = useState({
    enableFaceDetection: true,
    enableOutfitAnalysis: true,
    minimumConfidence: 0.65,
    recommendationWeights: {
      faceShape: 0.35,
      style: 0.25,
      occasion: 0.2,
      color: 0.2,
    },
    supportedFaceShapes: ["Oval", "Round", "Square", "Heart", "Long", "Diamond"],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    api
      .adminGetAISettings()
      .then((res) => {
        if (res) setSettings(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(false);
    try {
      await api.adminUpdateAISettings(settings);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const setWeight = (key, val) => {
    setSettings((prev) => ({
      ...prev,
      recommendationWeights: {
        ...(prev.recommendationWeights || {}),
        [key]: Number(val),
      },
    }));
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-textSecondary text-[13px] flex items-center justify-center gap-2">
        <RefreshCw size={15} className="animate-spin text-primaryDark" /> Loading AI Stylist configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
          AI Stylist & Computer Vision Configuration
        </h2>
        <p className="text-[13px] text-textSecondary mt-0.5">
          Tune client-side MediaPipe face-landmarker thresholds, feature availability, and recommendation scoring weights.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[13px] flex items-center gap-2">
          <CheckCircle size={15} /> AI Stylist settings updated and persisted to PostgreSQL SiteSetting.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Feature Toggles */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
          <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border">
            Feature Availability
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13.5px] font-medium text-slate-800">Client-Side Face Shape Detection</p>
              <p className="text-[12px] text-textSecondary">
                Uses in-browser MediaPipe Face Landmarker. Photos never leave user's device.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.enableFaceDetection}
              onChange={(e) =>
                setSettings((s) => ({ ...s, enableFaceDetection: e.target.checked }))
              }
              className="w-5 h-5 accent-primaryDark cursor-pointer"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[13.5px] font-medium text-slate-800">Outfit Photo Color Extraction</p>
              <p className="text-[12px] text-textSecondary">
                Enables outfit photo upload and canvas dominant color harmony matching.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.enableOutfitAnalysis}
              onChange={(e) =>
                setSettings((s) => ({ ...s, enableOutfitAnalysis: e.target.checked }))
              }
              className="w-5 h-5 accent-primaryDark cursor-pointer"
            />
          </div>
        </div>

        {/* Confidence Threshold */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-3">
          <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border">
            Face Detection Confidence Threshold
          </h3>
          <div>
            <div className="flex justify-between text-[13px] mb-1 font-medium">
              <span>Minimum Confidence Level</span>
              <span className="font-mono text-primaryDark">{Math.round((settings.minimumConfidence || 0.65) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="0.9"
              step="0.05"
              value={settings.minimumConfidence || 0.65}
              onChange={(e) =>
                setSettings((s) => ({ ...s, minimumConfidence: parseFloat(e.target.value) }))
              }
              className="w-full accent-primaryDark cursor-pointer"
            />
            <p className="text-[12px] text-textSecondary mt-1">
              Higher values ensure only unambiguous face-shape readings are accepted. Low confidence readings prompt the user to choose manually.
            </p>
          </div>
        </div>

        {/* Recommendation Weights */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
          <h3 className="text-[14.5px] font-semibold text-slate-900 pb-2 border-b border-border flex items-center gap-2">
            <Sliders size={16} className="text-primaryDark" /> Recommendation Engine Weights
          </h3>
          <p className="text-[12px] text-textSecondary">
            Adjust the relative contribution of each parameter when calculating personalized recommendation scores.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Face Shape Weight: {settings.recommendationWeights?.faceShape || 0.35}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={settings.recommendationWeights?.faceShape || 0.35}
                onChange={(e) => setWeight("faceShape", e.target.value)}
                className="w-full accent-primaryDark"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Style Preference Weight: {settings.recommendationWeights?.style || 0.25}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={settings.recommendationWeights?.style || 0.25}
                onChange={(e) => setWeight("style", e.target.value)}
                className="w-full accent-primaryDark"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Occasion Weight: {settings.recommendationWeights?.occasion || 0.2}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={settings.recommendationWeights?.occasion || 0.2}
                onChange={(e) => setWeight("occasion", e.target.value)}
                className="w-full accent-primaryDark"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-slate-700 mb-1">
                Color & Material Weight: {settings.recommendationWeights?.color || 0.2}
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={settings.recommendationWeights?.color || 0.2}
                onChange={(e) => setWeight("color", e.target.value)}
                className="w-full accent-primaryDark"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primaryDark text-white text-[13.5px] rounded-lg hover:bg-ink transition-colors font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save AI Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
