import assert from 'node:assert/strict';
import test from 'node:test';
import { generateIcsContent } from '../utils/calendarExport.ts';
import type { KairoSession } from '../types.ts';

test('generates valid RFC 5545 .ics calendar content', () => {
  const sessions: KairoSession[] = [
    {
      id: 'session-123',
      date: '2026-10-23T10:00:00.000Z',
      duration: 25,
      completed: true,
      type: 'focus',
      taskName: 'Revamp Architecture',
      intention: 'Clean up dead CSS files',
    },
    {
      id: 'session-break',
      date: '2026-10-23T10:25:00.000Z',
      duration: 5,
      completed: true,
      type: 'shortBreak',
    },
  ];

  const ics = generateIcsContent(sessions);

  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('END:VCALENDAR'));
  assert.ok(ics.includes('BEGIN:VEVENT'));
  assert.ok(ics.includes('UID:session-123@kairo.app'));
  assert.ok(ics.includes('SUMMARY:Focus: Revamp Architecture'));
  assert.ok(ics.includes('Goal: Clean up dead CSS files'));
  // Breaks should not be exported as calendar events
  assert.ok(!ics.includes('UID:session-break@kairo.app'));
});

test('generateIcsContent escapes newlines, semicolons, commas, and backslashes', () => {
  const sessions: KairoSession[] = [
    {
      id: 'session-injection\r\nUID:fake',
      date: '2026-10-23T14:00:00.000Z',
      duration: 30,
      completed: true,
      type: 'focus',
      taskName: 'Project, Part 1; Plan \\ Notes\r\nInjectedLine',
      intention: 'Write code, test; ship\nNext step',
    },
  ];

  const ics = generateIcsContent(sessions);
  // Must escape comma, semicolon, backslash and CRLF
  assert.ok(ics.includes('SUMMARY:Focus: Project\\, Part 1\\; Plan \\\\ Notes\\nInjectedLine'));
  assert.ok(ics.includes('Goal: Write code\\, test\\; ship\\nNext step'));
  // UID should strip CRLF and symbols
  assert.ok(ics.includes('UID:session-injectionUIDfake@kairo.app'));
});
