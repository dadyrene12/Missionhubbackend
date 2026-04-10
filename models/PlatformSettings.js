const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  advertisePayMode: {
    type: Boolean,
    default: false
  },
  provePayMode: {
    type: Boolean,
    default: false
  },
  advertisePrice: {
    type: Number,
    default: 10000
  },
  provePrice: {
    type: Number,
    default: 5000
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  emailVerificationRequired: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

platformSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

platformSettingsSchema.statics.updateSettings = async function(updates, adminId) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  Object.assign(settings, updates, { updatedBy: adminId, updatedAt: Date.now() });
  await settings.save();
  return settings;
};

module.exports = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', platformSettingsSchema);
