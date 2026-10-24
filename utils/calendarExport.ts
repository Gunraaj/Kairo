/**
 * calendarExport.ts
 * Generates portable RFC 5545 standard .ics calendar files
 * allowing users to sync their focus sessions with Apple Calendar,
 * Google Calendar, or Outlook without requiring any cloud server or OAuth tokens.
 */

import type { KairoSession } from '../types';

const formatIcsDate = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

export const generateIcsContent = (sessions: KairoSession[]): string => {
  const completedFocusSessions = sessions.filter(s => s.type === 'focus' && s.completed);
  const now = formatIcsDate(new Date());

  const events = completedFocusSessions.map(session => {
    const startDate = new Date(session.date);
    const endDate = new Date(startDate.getTime() + session.duration * 60 * 1000);
    const summary = session.taskName ? `Focus: ${session.taskName}` : 'Kairo Focus Session';
    const description = session.intention
      ? `Goal: ${session.intention}\\nDuration: ${session.duration} minutes`
      : `Duration: ${session.duration} minutes`;

    return [
      'BEGIN:VEVENT',
      `UID:${session.id}@kairo.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kairo Focus//Focus Sessions Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
};

export const downloadIcsFile = (sessions: KairoSession[], filename = 'kairo-focus-history.ics'): void => {
  const icsData = generateIcsContent(sessions);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
