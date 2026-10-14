const Event = require('../models/Event');

const REQUIRED_FIELDS = ['eventId', 'title', 'category', 'date', 'venue', 'organizer', 'capacity', 'status'];

const findEventQuery = (id) => {
  if (!id || typeof id !== 'string') {
    return { eventId: '' };
  }
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    return { $or: [{ _id: id }, { eventId: id.toUpperCase() }] };
  }
  return { eventId: id.toUpperCase() };
};

const buildEventPayload = (body) => ({
  eventId: body.eventId.trim().toUpperCase(),
  title: body.title.trim(),
  description: body.description ? String(body.description).trim() : '',
  category: body.category.trim(),
  date: body.date,
  venue: body.venue.trim(),
  organizer: body.organizer.trim(),
  capacity: Number(body.capacity),
  status: body.status.trim()
});

exports.getAllEvents = async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { eventId: regex },
        { title: regex },
        { description: regex },
        { venue: regex },
        { organizer: regex },
        { category: regex },
        { status: regex }
      ];
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    const events = await Event.find(query).sort({ date: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve events',
      error: error.message
    });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findOne(findEventQuery(req.params.id));

    if (!event) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${req.params.id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching event record',
      error: error.message
    });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const missing = REQUIRED_FIELDS.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || String(value).trim() === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Required fields missing: ${missing.join(', ')}`
      });
    }

    const existingEvent = await Event.findOne({ eventId: req.body.eventId.trim().toUpperCase() });
    if (existingEvent) {
      return res.status(400).json({
        success: false,
        message: `Event with Event ID '${req.body.eventId}' already exists.`
      });
    }

    const event = await Event.create(buildEventPayload(req.body));

    res.status(201).json({
      success: true,
      message: 'Event added successfully.',
      data: event
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `An event with this ${field} already exists.`
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message
    });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findOne(findEventQuery(req.params.id));

    if (!event) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${req.params.id}' not found`
      });
    }

    const { eventId, title, description, category, date, venue, organizer, capacity, status } = req.body;

    if (eventId && eventId.trim().toUpperCase() !== event.eventId) {
      const duplicate = await Event.findOne({ eventId: eventId.trim().toUpperCase() });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Event ID '${eventId}' is already assigned to another event.`
        });
      }
      event.eventId = eventId.trim().toUpperCase();
    }

    if (title !== undefined) event.title = title.trim();
    if (description !== undefined) event.description = String(description).trim();
    if (category !== undefined) event.category = category.trim();
    if (date !== undefined) event.date = date;
    if (venue !== undefined) event.venue = venue.trim();
    if (organizer !== undefined) event.organizer = organizer.trim();
    if (capacity !== undefined) event.capacity = Number(capacity);
    if (status !== undefined) event.status = status.trim();

    const updatedEvent = await event.save();

    res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      data: updatedEvent
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error.message
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndDelete(findEventQuery(req.params.id));

    if (!event) {
      return res.status(404).json({
        success: false,
        message: `Event with ID '${req.params.id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: `Event '${event.eventId}' (${event.title}) deleted successfully.`,
      data: { eventId: event.eventId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: error.message
    });
  }
};

exports.getEventStats = async (req, res) => {
  try {
    const [totalEvents, upcoming, ongoing, completed, cancelled] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: 'Upcoming' }),
      Event.countDocuments({ status: 'Ongoing' }),
      Event.countDocuments({ status: 'Completed' }),
      Event.countDocuments({ status: 'Cancelled' })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEvents,
        upcoming,
        ongoing,
        completed,
        cancelled
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message
    });
  }
};
