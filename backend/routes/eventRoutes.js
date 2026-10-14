const express = require('express');
const router = express.Router();
const {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventStats
} = require('../controllers/eventController');

router.get('/stats/summary', getEventStats);

router.route('/')
  .get(getAllEvents)
  .post(createEvent);

router.route('/:id')
  .get(getEventById)
  .put(updateEvent)
  .delete(deleteEvent);

module.exports = router;
