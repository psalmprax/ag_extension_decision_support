import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { fetchVisits, Visit } from '@/api/visitService';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = defaultIcon;

export const VisitPlanningScreen = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVisits = async () => {
      try {
        setLoading(true);
        const response = await fetchVisits();
        if (response.success && response.data?.visits) {
          // Sort visits by scheduled date
          const sortedVisits = response.data.visits.sort((a, b) => 
            new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
          );
          setVisits(sortedVisits);
        } else {
          setError('Failed to fetch visits data.');
        }
      } catch (err: unknown) {
        setError((err as Error).message || 'An error occurred while fetching visits.');
      } finally {
        setLoading(false);
      }
    };

    loadVisits();
  }, []);

  const totalKMs = visits.length * 8.5; // Mock calculation based on visit count
  const completedVisits = visits.filter(v => v.status === 'completed').length;
  const efficiencyScore = visits.length ? Math.round((completedVisits / visits.length) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Smart Visit Planning</h1>
          <p className="text-gray-500 mt-1">AI-optimized routes and scheduling for your extension territory.</p>
        </div>
        <button className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-primary-500/30 transition-all">
          Generate Optimized Route
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Schedule List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <CalendarDays size={20} className="text-primary-500" /> Today's Itinerary
          </h2>
          
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : visits.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl text-center border border-gray-100 dark:border-gray-700 text-gray-500">
              No visits scheduled for today.
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-primary-100 before:to-transparent">
              {/* eslint-disable-next-line sonarjs/cognitive-complexity */}
              {visits.map((visit) => {
                const date = new Date(visit.scheduled_at);
                const isHighPriority = visit.visit_type === 'urgent';
                
                return (
                  <div key={visit.id} className="relative pl-6 pb-6 border-l-2 border-primary-100 dark:border-primary-900/30">
                    <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-1 border-4 border-white dark:border-gray-900 shadow-sm ${
                      visit.status === 'completed' ? 'bg-green-500' : 
                      isHighPriority ? 'bg-red-500' : 'bg-primary-500'
                    }`} />
                    
                    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-opacity ${
                      visit.status === 'completed' ? 'opacity-60' : 'opacity-100'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg">{visit.farmer_name}</h3>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          isHighPriority ? 'bg-red-100 text-red-600' : 
                          visit.status === 'completed' ? 'bg-green-100 text-green-600' :
                          'bg-primary-50 text-primary-600'
                        }`}>
                          {visit.status === 'completed' ? 'Done' : isHighPriority ? 'High Priority' : 'Routine'}
                        </span>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                        <p className="flex items-center gap-2"><MapPin size={14} /> Farm ID: {visit.farmer_id.substring(0,8)}...</p>
                        <p className="flex items-center gap-2"><Clock size={14} /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      {visit.notes && (
                        <p className="text-sm bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700 line-clamp-2">
                          <span className="font-semibold block mb-1">AI Note:</span>
                          {visit.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Map & Metrics */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl h-96 flex items-center justify-center border border-gray-300 dark:border-gray-700 shadow-inner relative overflow-hidden z-0">
            <MapContainer 
              center={[-1.2921, 36.8219]} // Default center (Nairobi)
              zoom={11} 
              scrollWheelZoom={true} 
              className="w-full h-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {visits.map((visit, index) => {
                // Generate a slight offset for demo purposes if real coordinates aren't returned yet
                const lat = -1.2921 + (index * 0.01);
                const lng = 36.8219 + (index * 0.01);
                
                return (
                  <Marker key={visit.id} position={[lat, lng]}>
                    <Popup>
                      <div className="font-sans">
                        <strong>{visit.farmer_name}</strong><br />
                        {visit.visit_type === 'urgent' ? 'High Priority' : 'Routine'}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-3xl font-bold text-primary-600">{loading ? '-' : totalKMs}</p>
              <p className="text-sm text-gray-500 font-medium mt-1">Est. Total KMs</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-3xl font-bold text-emerald-600">{loading ? '-' : visits.length}</p>
              <p className="text-sm text-gray-500 font-medium mt-1">Farms Covered</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <p className="text-3xl font-bold text-blue-600">{loading ? '-' : `${efficiencyScore}%`}</p>
              <p className="text-sm text-gray-500 font-medium mt-1">Completion Score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
