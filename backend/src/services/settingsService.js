/**
 * Phase 5 — site settings. Backed by SiteSetting (key/value), with hardcoded
 * defaults here so the app works correctly before any admin has touched
 * Settings — a fresh install shouldn't behave differently from one where an
 * admin explicitly set every value to what was already the default.
 */
const { prisma } = require("../db/prisma");

const DEFAULTS = {
  "shipping.freeThreshold": 100, // order subtotal ($) at or above which shipping is free
  "shipping.flatRate": 8, // shipping cost ($) below the free threshold
};

async function getSetting(key) {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row ? row.value : DEFAULTS[key];
}

async function getSettings(keys) {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return Object.fromEntries(keys.map(k => [k, byKey[k] ?? DEFAULTS[k]]));
}

async function getAllSettings() {
  const rows = await prisma.siteSetting.findMany();
  const byKey = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Every default is always represented, even if never explicitly set, so
  // the admin settings screen shows the real effective value, not a blank.
  return { ...DEFAULTS, ...byKey };
}

async function setSetting(key, value, updatedBy) {
  return prisma.siteSetting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
}

module.exports = { getSetting, getSettings, getAllSettings, setSetting, DEFAULTS };
