import React from 'react';

/** The small line icons used in the sidebar (16px, inherit text colour). */
export const NavIcon: React.FC<{
  name:
    | 'folder'
    | 'folder-open'
    | 'doc'
    | 'plus'
    | 'chart'
    | 'settings'
    | 'archive'
    | 'chevron'
    | 'chevron-down'
    | 'trash'
    | 'copy'
    | 'check'
    | 'sun'
    | 'moon'
    | 'system'
    | 'sound'
    | 'keyboard'
    | 'mail'
    | 'book'
    | 'sparkles'
    | 'help'
    | 'today'
    | 'timer';
}> = ({ name }) => {
  const shared = {
    className: 'k-nav-icon',
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'folder':
      return <svg {...shared}><path d="M2 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" /></svg>;
    case 'folder-open':
      return <svg {...shared}><path d="M2 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1v1H2z" /><path d="M2 6.5h12l-1.5 5.7a1 1 0 01-1 .8H3a1 1 0 01-1-1z" /></svg>;
    case 'doc':
      return <svg {...shared}><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M9 2v3h3" /></svg>;
    case 'plus':
      return <svg {...shared}><path d="M8 3v10M3 8h10" /></svg>;
    case 'chart':
      return <svg {...shared}><path d="M3 13V6M7 13V3M11 13V9" /></svg>;
    case 'settings':
      return <svg {...shared}><circle cx="8" cy="8" r="2" /><path d="M6.9 1.8h2.2l.4 1.7 1.1.6 1.6-.6 1.1 1.9-1.3 1.2v1.2l1.3 1.2-1.1 1.9-1.6-.6-1.1.6-.4 1.7H6.9l-.4-1.7-1.1-.6-1.6.6-1.1-1.9 1.3-1.2V6.6L2.7 5.4l1.1-1.9 1.6.6 1.1-.6z" /></svg>;
    case 'timer':
      return <svg {...shared}><circle cx="8" cy="9" r="5" /><path d="M8 6.5V9l1.6 1M6.5 2h3M12.2 4.3l.9-.9" /></svg>;
    case 'archive':
      return <svg {...shared}><rect x="2" y="3" width="12" height="3" rx="0.5" /><path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6M6.5 9h3" /></svg>;
    case 'chevron':
      return <svg {...shared}><path d="M6 4l4 4-4 4" /></svg>;
    case 'chevron-down':
      return <svg {...shared}><path d="M4 6l4 4 4-4" /></svg>;
    case 'trash':
      return <svg {...shared}><path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4.5 4l.6 8.5a1 1 0 001 .9h3.8a1 1 0 001-.9L11.5 4" /></svg>;
    case 'copy':
      return <svg {...shared}><rect x="5" y="5" width="8.5" height="8.5" rx="1.2" /><path d="M11 5V3.5a1 1 0 00-1-1H3.5a1 1 0 00-1 1V10a1 1 0 001 1H5" /></svg>;
    case 'check':
      return <svg {...shared}><path d="M3 8l3 3 7-7" /></svg>;
    case 'sun':
      return <svg {...shared}><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" /></svg>;
    case 'moon':
      return <svg {...shared}><path d="M13 9.5A5.5 5.5 0 116.5 3a4.5 4.5 0 006.5 6.5z" /></svg>;
    case 'system':
      return <svg {...shared}><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M6 13h4M8 11v2" /></svg>;
    case 'sound':
      return <svg {...shared}><path d="M3 6v4h3l4 4V2L6 6H3zM13 5a5 5 0 010 6" /></svg>;
    case 'keyboard':
      return <svg {...shared}><rect x="2" y="4" width="12" height="8" rx="1" /><path d="M4 7h1M7 7h1M10 7h1M5 10h6" /></svg>;
    case 'mail':
      return <svg {...shared}><path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" /><path d="M2 5l6 4 6-4" /></svg>;
    case 'book':
      return (
        <svg {...shared}>
          <path d="M2 3.5A1.5 1.5 0 013.5 2H7v12H3.5A1.5 1.5 0 012 12.5v-9zM14 3.5A1.5 1.5 0 0012.5 2H9v12h3.5a1.5 1.5 0 001.5-1.5v-9z" />
        </svg>
      );
    case 'today':
      return <svg {...shared}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
    case 'help':
      return <svg {...shared}><circle cx="8" cy="8" r="6" /><path d="M6.2 6.3a1.9 1.9 0 013.6.7c0 1.3-1.8 1.4-1.8 2.6M8 11.6v.1" /></svg>;
    case 'sparkles':
      return (
        <svg {...shared}>
          <path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5l-1.2-3.3L3.5 6l3.3-1.2L8 1.5zM12.5 10.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z" />
        </svg>
      );
  }
};
