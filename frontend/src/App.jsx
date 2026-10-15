import React, { useState, useEffect, useCallback } from 'react';
import { Search, CalendarPlus } from 'lucide-react';
import Header from './components/Header';
import ArchitectureBanner from './components/ArchitectureBanner';
import EventStats from './components/EventStats';
import EventTable from './components/EventTable';
import EventModal from './components/EventModal';
import DeleteModal from './components/DeleteModal';
import Toast from './components/Toast';
import { eventAPI } from './services/api';

const CATEGORIES = ['Workshop', 'Hackathon', 'Seminar', 'Competition', 'Cultural'];

const EMPTY_STATS = {
  totalEvents: 0,
  upcoming: 0,
  ongoing: 0,
  completed: 0
};

export default function App() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [backendHealthy, setBackendHealthy] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(true);

  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const health = await eventAPI.checkHealth();
      setBackendHealthy(health?.database === 'connected' || health?.status === 'UP');
    } catch (err) {
      setBackendHealthy(false);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await eventAPI.getStats();
      if (res && res.data) {
        setStats({
          totalEvents: res.data.totalEvents || 0,
          upcoming: res.data.upcoming || 0,
          ongoing: res.data.ongoing || 0,
          completed: res.data.completed || 0
        });
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventAPI.getAll({
        search: searchTerm,
        category: selectedCategory
      });
      if (res && res.data) {
        setEvents(res.data);
        setBackendHealthy(true);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setBackendHealthy(false);
      addToast(err.message || 'Failed to fetch events from backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  useEffect(() => {
    checkHealth();
    fetchStats();
  }, [checkHealth, fetchStats]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchEvents();
    }, 250);
    return () => clearTimeout(timeout);
  }, [fetchEvents]);

  const handleSaveEvent = async (eventData, isEditing) => {
    if (isEditing) {
      await eventAPI.update(eventData.eventId, eventData);
      addToast(`Event '${eventData.eventId}' updated successfully!`, 'success');
    } else {
      await eventAPI.create(eventData);
      addToast(`Event '${eventData.eventId}' added successfully!`, 'success');
    }
    await Promise.all([fetchEvents(), fetchStats()]);
  };

  const handleEditClick = (event) => {
    setEventToEdit(event);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (event) => {
    setEventToDelete(event);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async (eventId) => {
    try {
      await eventAPI.delete(eventId);
      addToast(`Event '${eventId}' deleted successfully.`, 'success');
      await Promise.all([fetchEvents(), fetchStats()]);
    } catch (err) {
      addToast(err.message || 'Failed to delete event', 'error');
      throw err;
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchEvents(), fetchStats(), checkHealth()]);
  };

  return (
    <div className="app-container">
      <Header onRefresh={handleRefresh} loading={loading} />

      <main className="main-content">
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-kicker">
              <span className="hero-kicker-dot" />
              Three-tier cloud architecture
            </div>
            <h1>Campus events, beautifully organized.</h1>
            <p className="hero-lede">
              Create, search, and manage workshops, hackathons, seminars, competitions,
              and cultural events from one dashboard.
            </p>
            <div className="hero-meta">
              <span className="hero-chip">Netlify · Presentation</span>
              <span className="hero-chip">Render · API</span>
              <span className="hero-chip">MongoDB Atlas · Data</span>
            </div>
            <ArchitectureBanner
              backendHealthy={backendHealthy}
              checkingHealth={checkingHealth}
            />
          </div>
        </section>

        <div className="section-label">
          <h2>At a glance</h2>
          <p>Live counts from the events collection</p>
        </div>
        <EventStats stats={stats} />

        <div className="section-label">
          <h2>Manage events</h2>
          <p>Search by id, title, venue, organizer, or category</p>
        </div>
        <div className="action-bar">
          <div className="search-group">
            <div className="search-input-wrapper">
              <Search size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Search by ID, title, venue, organizer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setEventToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <CalendarPlus size={18} /> Add Event
          </button>
        </div>

        <EventTable
          events={events}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
        />
      </main>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEventToEdit(null);
        }}
        onSave={handleSaveEvent}
        eventToEdit={eventToEdit}
      />

      <DeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        event={eventToDelete}
      />

      <Toast toasts={toasts} onDismiss={removeToast} />

      <footer className="app-footer">
        <p>Campus Event Hub · Three-tier cloud architecture</p>
        <div className="footer-tags">
          <span className="footer-tag">Netlify · Presentation</span>
          <span className="footer-tag">Render · Application</span>
          <span className="footer-tag">MongoDB Atlas · Database</span>
        </div>
      </footer>
    </div>
  );
}
