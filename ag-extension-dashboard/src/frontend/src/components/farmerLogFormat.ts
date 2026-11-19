export const getLogTypeColor = (type: string) => {
  if (type === 'SMS') return 'bg-blue-100 text-blue-600';
  if (type === 'CHAT') return 'bg-purple-100 text-purple-600';
  return 'bg-green-100 text-green-600';
};

export const getLogContent = (log: Record<string, unknown>) => {
  if (log.content) return log.content as string;
  if (log.type === 'CALL') return `Outbound call duration: ${log.duration}`;
  return '';
};
