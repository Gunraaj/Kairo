import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
# remove default sheet
wb.remove(wb.active)

# Color Palette inspired by Kairo (Obsidian & Sumi & Vermilion Accent)
HEADER_FILL = PatternFill(start_color="1A1D20", end_color="1A1D20", fill_type="solid")
HEADER_FONT = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
SUBHEADER_FILL = PatternFill(start_color="2A2F35", end_color="2A2F35", fill_type="solid")
SUBHEADER_FONT = Font(name="Segoe UI", size=10, bold=True, color="E2E8F0")

CELL_FONT = Font(name="Segoe UI", size=10, color="1E293B")
CELL_FONT_MUTED = Font(name="Segoe UI", size=9, color="64748B")
STATUS_DONE_FILL = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid") # light green
STATUS_DONE_FONT = Font(name="Segoe UI", size=10, bold=True, color="166534")
STATUS_IN_PROGRESS_FILL = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid") # light yellow
STATUS_IN_PROGRESS_FONT = Font(name="Segoe UI", size=10, bold=True, color="92400E")
STATUS_PLANNED_FILL = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid") # light blue
STATUS_PLANNED_FONT = Font(name="Segoe UI", size=10, bold=True, color="075985")

THIN_BORDER = Border(
    left=Side(style='thin', color="CBD5E1"),
    right=Side(style='thin', color="CBD5E1"),
    top=Side(style='thin', color="CBD5E1"),
    bottom=Side(style='thin', color="CBD5E1")
)

def style_sheet(ws, title, columns, data):
    ws.title = title
    ws.views.sheetView[0].showGridLines = True
    
    # Title Row
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columns))
    title_cell = ws.cell(row=1, column=1, value=f"KAIRO FOCUS OS — {title.upper()}")
    title_cell.font = Font(name="Segoe UI", size=14, bold=True, color="FFFFFF")
    title_cell.fill = HEADER_FILL
    title_cell.alignment = Alignment(horizontal="center", vertical="center", indent=0)
    ws.row_dimensions[1].height = 36

    # Column Headers
    ws.row_dimensions[2].height = 24
    for col_idx, col_name in enumerate(columns, start=1):
        cell = ws.cell(row=2, column=col_idx, value=col_name)
        cell.font = HEADER_FONT
        cell.fill = SUBHEADER_FILL
        cell.alignment = Alignment(horizontal="left", vertical="center")
        cell.border = THIN_BORDER

    # Data Rows
    for row_idx, row_data in enumerate(data, start=3):
        ws.row_dimensions[row_idx].height = 22
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = CELL_FONT
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            
            # Status styling
            if str(val).lower() in ["completed", "done", "shipped"]:
                cell.fill = STATUS_DONE_FILL
                cell.font = STATUS_DONE_FONT
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif str(val).lower() in ["in progress", "active", "testing"]:
                cell.fill = STATUS_IN_PROGRESS_FILL
                cell.font = STATUS_IN_PROGRESS_FONT
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif str(val).lower() in ["planned", "brainstorming", "spec ready"]:
                cell.fill = STATUS_PLANNED_FILL
                cell.font = STATUS_PLANNED_FONT
                cell.alignment = Alignment(horizontal="center", vertical="center")

    # Column Widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.row == 1:
                continue
            val_str = str(cell.value or '')
            max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = min(max(max_len + 4, 14), 50)

# 1. Sheet: Milestones & Feature Status
milestones_cols = ["ID", "Feature Name", "Domain", "Status", "Deliverable / Verification"]
milestones_data = [
    ["MS-01", "Collapsed Sidebar Overlap & Scrollbar Fix", "UI / Shell", "Completed", "Vertical flex layout, centered 36x36 action icons, hidden overflow"],
    ["MS-02", "Tactile Audio-Haptic Timer Dial", "Interaction", "Completed", "Snapping ticks, audio cue synth, pointer physics, keyboard controls"],
    ["MS-03", "Focus To-Do Style Whole-Number Targets", "Core Focus", "Completed", "Integer rounds (●●●○), exact target hours, no fractional Pomodoros"],
    ["MS-04", "Active Task Dial Countdown Sync", "Timer Engine", "Completed", "Dial counts down in real-time, updates task badge time dynamically"],
    ["MS-05", "Pure Dark / Light Dual Mode (No System)", "Theming", "Completed", "Clean binary toggle in header & settings, Washi paper & sumi ink tones"],
    ["MS-06", "Generic AI Slice Elimination", "Data Engine", "Completed", "Removed AI template injection, offline syllabus parser, user-driven structure"],
    ["MS-07", "Windows-Style Sound Studio Mute Icon", "Audio Studio", "Completed", "Speaker icon with diagonal cross/sound waves, stateful mute toggle"],
    ["MS-08", "YouTube Focus Streams Permission Fix", "Audio Studio", "Completed", "Enhanced sandbox & feature permissions for Lofi Girl / focus stream playback"],
    ["MS-09", "Pomofocus-Style Finish Time & Overall Bar", "Planning", "Completed", "Pomos: 0/9 • Finish At: 21:59 (4.7h) factoring focus + short + long breaks"],
    ["MS-10", "Contextual (i) Info Tips & First-Time Hints", "UX Guidance", "Completed", "Dismissible, accessible popovers for dial, modes, targets, and breaks"],
    ["MS-11", "Mobile Responsive Drawer (Step 1)", "Mobile UX", "Completed", "Sliding sidebar drawer overlay, backdrop dismissal, responsive dial scaling"],
    ["MS-12", "GDPR / EU-Compliant Telemetry Framework", "Privacy & Cloud", "Spec Ready", "Zero-ad, opt-in consent model, hashed links, ambient frequency aggregation"],
    ["MS-13", "Community Ambient Mixes & Curation", "Cloud Audio", "Planned", "Anonymous crowdsourced focus mixes by study/work archetype"],
    ["MS-14", "Task Queuing & Project Bundling", "Task Mgmt", "Brainstorming", "Sequential auto-advance queue across project tasks with compound finish time"],
]
ws1 = wb.create_sheet(title="Milestones")
style_sheet(ws1, "Milestones & Capabilities", milestones_cols, milestones_data)

# 2. Sheet: Mobile UX Step-by-Step
mobile_cols = ["Step", "Focus Area", "Device / Breakpoint", "Status", "Technical Implementation", "Verification"]
mobile_data = [
    ["Phase 1", "Sidebar to Off-Canvas Drawer", "< 768px (Mobile)", "Completed", "Fixed drawer sliding from left (min 85vw, 320px), backdrop overlay, tap outside to close", "Tested via Playwright 375x667"],
    ["Phase 1", "Header Collapse Toggle Adapter", "< 768px (Mobile)", "Completed", "Converts desktop collapse chevron into hamburger (☰) / close (✕) toggle", "Tested via Playwright 375x667"],
    ["Phase 1", "Responsive Dial Scaling", "< 480px (Compact)", "Completed", "Dial clamped to min(80vw, 270px), timer readout scaled to 46px, touch friendly", "Touch drag verified"],
    ["Phase 2", "Bottom Navigation Quick Bar", "< 768px (Mobile)", "Planned", "Thumb-zone bottom action bar for Play/Pause, Skip, Mode switch, Sound Studio", "Ergonomic mobile reachability"],
    ["Phase 2", "Mobile Sound Studio Bottom Sheet", "< 768px (Mobile)", "Planned", "Sliding bottom sheet modal instead of side drawer for ambient mixing on phone", "Touch scrollable sliders"],
    ["Phase 3", "PWA Offline Install & Service Worker", "iOS & Android PWA", "Planned", "Web app manifest, standalone display mode, background timer notifications", "Add to Home Screen flow"],
]
ws2 = wb.create_sheet(title="Mobile UX Steps")
style_sheet(ws2, "Mobile UX Roadmap", mobile_cols, mobile_data)

# 3. Sheet: GDPR Telemetry & Privacy
gdpr_cols = ["Dimension", "Policy & Ethical Guardrail", "Technical Architecture", "User Control & Transparency", "EU / GDPR Compliance"]
gdpr_data = [
    ["Consent Standard", "Explicit Opt-In Only (Zero Pre-checked boxes)", "kairo_telemetry_consent key in localStorage; default is false/untracked", "Clear onboarding toggle with plain-English explanation; dismissible anytime", "GDPR Art. 6(1)(a) & Art. 7"],
    ["No Advertising / Tracking", "100% Ad-Free, No Google Analytics, No Meta Pixel", "Zero third-party marketing SDKs or cross-site tracking scripts bundled in code", "Code audited locally; transparent open architecture", "ePrivacy Directive (2002/58/EC)"],
    ["Telemetry Scope", "Only Anonymous Aggregate Media & Mix Patterns", "Hashed URL tokens (sha256 of YouTube video ID only, no query params, no user info)", "Users can inspect outgoing payload directly in Settings > Privacy tab", "GDPR Recital 26 (Anonymization)"],
    ["Data Collected", "1. Sound mix channel volume presets\n2. YouTube stream IDs\n3. General focus archetype (Dev, Writing, Exam)", "Payload: { archetype: 'dev', ambient: { rain: 0.4, binaural: 0.1 }, lofi_id: 'jfKfPfyJRdk' }", "No IP storage, no device fingerprinting, no email or user identifier attached", "Data Minimization (Art. 5(1)(c))"],
    ["Cloud Storage", "Stateless append-only aggregation buffer", "Daily rolled aggregations; individual submissions deleted after rolling", "Right to erasure / Right to object built into Settings single-click wipe", "Right to Forgotten (Art. 17)"],
    ["Value Return", "Community Sound Presets returned to user", "Aggregate top 5 streams and ambient sound balances populated as 'Community Mixes'", "Available to all users regardless of opt-in status (no paywall or lock)", "Ethical value exchange"],
]
ws3 = wb.create_sheet(title="GDPR & Telemetry")
style_sheet(ws3, "GDPR & Privacy Architecture", gdpr_cols, gdpr_data)

# 4. Sheet: Community Sound Mixes
sound_cols = ["Capability", "Description", "Data Schema / Protocol", "Offline / Fallback Mode", "Status"]
sound_data = [
    ["Curated Lofi Streams", "Pre-verified top focus YouTube streams (Lofi Girl, Chillhop, Coffee Shop)", "Embed URL with standardized allow flags and direct link fallback", "Works without cloud using bundled curated fallback streams", "Completed"],
    ["Ambient Sound Studio", "Local Web Audio synthesizer + Moodist audio samples", "Layered channel strips (Binaural, Rain, Waves, Campfire, White/Pink noise)", "100% offline synthesis via HTML5 Audio + Web Audio API", "Completed"],
    ["Windows-Style Mute", "One-click toggle with visual diagonal slash and sound waves", "SVG stateful icon matching OS native audio cues", "Instant zero-latency UI response", "Completed"],
    ["Crowdsourced Presets", "Top mixes categorized by study/work interest area (Deep Code, Late Night, Study Hall)", "{ category: string, mixes: [{ title: string, channels: Record<string, number> }] }", "Default preset library pre-bundled in repository", "Planned"],
    ["Stream Health Checker", "Lightweight client-side check to detect offline or blocked YouTube streams", "Iframe load listener with error boundary fallback to secondary stream", "Graceful fallback notice with direct stream open link", "Planned"],
]
ws4 = wb.create_sheet(title="Community Audio")
style_sheet(ws4, "Sound Studio & Mixes", sound_cols, sound_data)

# 5. Sheet: Task Queues & Bundling
queue_cols = ["Feature", "Description", "Calculation Engine", "UX & Interaction", "Status"]
queue_data = [
    ["Pomofocus Summary Bar", "Overall summary bar compiling all project tasks: Pomos 0/9 • Finish At: 21:59 (4.7h)", "calculateFinishEstimate(tasks, focusLen, shortBreak, longBreak, longBreakInterval)", "Sticky summary bar at top of project list with InfoTip guidance", "Completed"],
    ["Target Popover Finish Pill", "Live estimated finish time inside Pomodoro target popover as user clicks rounds", "Instant finish time recalculation based on current clock + task duration", "Real-time badge showing 'Finish ~18:45' directly beside target rounds", "Completed"],
    ["Duration Chips Quick Target", "Set task target by duration chips (30m, 45m, 1h, 1.5h, 2h, 3h, 4h)", "Math.ceil(minutes / pomodoroLength) auto-dividing total time into discrete Pomodoros", "1-click chips on target popover eliminating manual round calculation", "Completed"],
    ["Sequential Focus Queue", "Auto-advance to next task in queue when current task target is reached", "Queue pointer state stored in project order; next task auto-highlighted on break end", "Drag-and-drop task reordering in sidebar; 'Queue Active' banner", "Brainstorming"],
    ["Project Bundling / Sprints", "Bundle multiple tasks or an entire project module into a dedicated focus sprint", "Aggregates total sprint minutes and schedules break cadence across multi-hour blocks", "Multi-select checkboxes in project tree with 'Focus Sprint' trigger", "Brainstorming"],
]
ws5 = wb.create_sheet(title="Task Queuing")
style_sheet(ws5, "Task Queuing & Bundling", queue_cols, queue_data)

wb.save("d:/Coding/PROJECTS/kairo/ROADMAP.xlsx")
print("Successfully generated ROADMAP.xlsx with 5 comprehensive sheets!")
