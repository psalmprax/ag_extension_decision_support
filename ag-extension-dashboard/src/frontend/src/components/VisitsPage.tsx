import { useDesign } from '@/hooks/useDesignVariant';
import { Calendar, Clock, MapPin, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface Visit {
  id: string;
  farmerName: string;
  date: string;
  time: string;
  type: string;
}

interface VisitsPageProps {
  visits: Visit[];
  onSchedule?: (visit: Partial<Visit>) => void;
}

const CurrentVisitsPage: React.FC<VisitsPageProps> = ({ visits }) => (
  <div className="flex gap-4 p-4 bg-gray-50">
    <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-sm font-semibold text-gray-700 mb-3">Calendar</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }, (_, i) => (
          <div
            key={i}
            className={`h-10 flex items-center justify-center text-sm ${
              i === 12 ? 'bg-green-500 text-white rounded' : 'text-gray-600'
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
    <div className="w-72 bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-sm font-semibold text-gray-700 mb-3">Upcoming Visits</div>
      <div className="space-y-2">
        {visits.slice(0, 3).map((visit) => (
          <div key={visit.id} className="p-2 bg-gray-50 rounded">
            <div className="text-sm font-medium text-gray-900">{visit.farmerName}</div>
            <div className="text-xs text-gray-500">{visit.date} at {visit.time}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const NewVisitsPage: React.FC<VisitsPageProps> = ({ visits, onSchedule }) => (
  <div className="flex gap-6 p-6 bg-gray-50 dark:bg-gray-900">
    <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-black/5 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">April 2026</h2>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <button
          onClick={() => onSchedule?.({})}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-semibold text-white shadow-lg shadow-green-500/25"
        >
          <Plus className="w-4 h-4" />
          Schedule Visit
        </button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => {
            const day = i - 3;
            const hasVisit = [12, 15, 22].includes(day);
            const isToday = day === 13;
            return (
              <div
                key={i}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  day < 1 || day > 30 ? 'text-gray-300 dark:text-gray-600' :
                  isToday ? 'bg-green-500 text-white shadow-lg shadow-green-500/25' :
                  hasVisit ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium' :
                  'text-gray-700 dark:text-gray-200'
                }`}
              >
                <span>{day > 0 && day < 31 ? day : ''}</span>
                {hasVisit && day > 0 && day < 31 && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isToday ? 'bg-white' : 'bg-green-500'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    <div className="w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-black/5 overflow-hidden">
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Today's Schedule</h3>
        <p className="text-sm text-gray-500">Tuesday, April 13</p>
      </div>
      <div className="p-4 space-y-3">
        {visits.slice(0, 4).map((visit) => (
          <div
            key={visit.id}
            className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-sm font-bold text-white">
                {visit.farmerName.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white">{visit.farmerName}</div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {visit.time}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {visit.type}
                </span>
              </div>
            </div>
            <div className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
              {visit.type}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const VisitsPage: React.FC<VisitsPageProps> = (props) => {
  const Visits = useDesign({
    current: CurrentVisitsPage,
    new: NewVisitsPage,
  });
  return <Visits {...props} />;
};

export default VisitsPage;
