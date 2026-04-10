const mongoose = require('mongoose');

const galleryPostSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  url: String,
  caption: String,
  tags: [String],
  campaign: {
    type: String,
    enum: ['hiring', 'project', 'culture', 'product', 'event', 'general'],
    default: 'general'
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

galleryPostSchema.index({ companyId: 1, createdAt: -1 });
galleryPostSchema.index({ tags: 1 });

module.exports = mongoose.models.GalleryPost || mongoose.model('GalleryPost', galleryPostSchema);
