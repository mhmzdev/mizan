PRD: The Infinite Timeline Engine (v1.0)
1. Executive Summary
A high-performance, virtualized historical timeline spanning ~6,000 years (Adam to Present). The goal is to provide a smooth, "Google Maps-like" navigation experience through time, using a hierarchical zoom system to prevent information overload.
2. Core Functional Requirements
A. The Coordinate System (The "Jesus Anchor")
Zero-Point: The transition between 1 BC and 1 AD is the mathematical origin ($X=0$).
Integer Logic: Internal math treats years as continuous integers.
Display Logic: UI converts integers to "BC" and "AD" labels (e.g., -1 becomes 1 BC, 0 becomes 1 AD).
B. Hierarchical Navigation (LOD)
The app operates in three distinct Modes, indicated and controlled by the Right Sidebar:
Century Mode: $X$-axis ticks every 100 units. Shows "Macro-History" and event density.
Decade Mode: Subdivides the active century into 10-unit blocks.
Year Mode: The most granular view. One year = large screen width. This is the only mode where individual "Event Dots" are rendered.
C. Performance: 1D Virtualization
Visible Windowing: The app shall only render DOM elements (or Canvas objects) for years currently within the viewport + a small buffer zone.
Recycling: As a user scrolls horizontally, off-screen "Year Blocks" are unmounted/pooled to keep memory usage flat.

3. Technical Stack (The Prototype)
Frontend: Next.js + Tailwind CSS.
State Management: Zustand (specifically for high-frequency $X$-scroll updates).
Physics/Animations: Framer Motion for smooth "Zoom-to-Year" transitions.
Data Handling: Local JSON file (initially) $\rightarrow$ Supabase/PostgreSQL (once data grows).

4. The "Multi-Track" Foundation
While we are not building a full editor, the engine must support Parallel Tracks.
Visuals: The timeline is divided into horizontal lanes (e.g., Lane 1: Global Events, Lane 2: My Study Notes).
Data Layer: Every event must have a track_id so they can be rendered in the correct vertical lane.

5. Success Metrics for the Prototype
Frame Rate: Constant 60fps during horizontal panning.
Zero Jitter: No "jumpiness" when switching from BC to AD.
Navigation Speed: Ability to jump from year 2026 to year -2000 (Adam era) via the sidebar in under 2 seconds.

6. Out of Scope (For Now)
Rich Text Editor: Only simple text inputs for event descriptions.
Image Uploads: Placeholder icons only.
Social/Sharing: This is a local-first study tool.
Sub-year Precision: No months or days.

7. The First Engineering Task: The Stress Test
Before we build the UI, we must execute the 7,000-Year Stress Test.
Create an array of 7,000 objects.
Render them in a horizontal scroll container using your virtualization logic.
Test on both Desktop and Mobile Chrome
