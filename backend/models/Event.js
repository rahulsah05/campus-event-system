const mongoose = require('mongoose');

const CATEGORIES = ['Workshop', 'Hackathon', 'Seminar', 'Competition', 'Cultural'];
const STATUSES = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];

const eventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: 'Category must be Workshop, Hackathon, Seminar, Competition, or Cultural'
      },
      trim: true
    },
    date: {
      type: Date,
      required: [true, 'Event date is required']
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true
    },
    organizer: {
      type: String,
      required: [true, 'Organizer is required'],
      trim: true
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1']
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: STATUSES,
        message: 'Status must be Upcoming, Ongoing, Completed, or Cancelled'
      },
      default: 'Upcoming',
      trim: true
    }
  },
  {
    timestamps: true,
    collection: 'events'
  }
);

eventSchema.statics.CATEGORIES = CATEGORIES;
eventSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Event', eventSchema);
