import { ChevronRight, User } from 'lucide-react';
import type { Contact } from './types';

export function ContactListItem({
  contact,
  isSelected,
  onClick,
  radiusClass,
}: {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
  radiusClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 ${radiusClass} transition-all ${
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-3 text-left">
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <User className="w-5 h-5 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
            {contact.name}
          </p>
          <p className="text-xs text-slate-500">{contact.phone}</p>
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 text-slate-300 ${isSelected ? 'text-primary-500' : ''}`} />
    </button>
  );
}
