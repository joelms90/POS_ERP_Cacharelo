<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read:
specs/010-multi-role-users/plan.md
<!-- SPECKIT END -->

# UI Responsiveness Guidelines
- **Avoid Fixed Page Heights on Mobile**: Never apply fixed height classes like `h-screen` or `h-full` to page panel container wrappers on mobile. Use `lg:h-full min-h-full` and set `overflow-y-auto lg:overflow-hidden` so page content expands and scrolls vertically on mobile viewports.
- **Responsive Heading Sizes**: For long section headers, use responsive text size classes (e.g., `!text-lg sm:!text-2xl`) to avoid text clipping on narrow mobile screens.
- **Adaptive Split Layouts**: Double-panel views (e.g., table list on the left, creation form on the right) must stack vertically on mobile using `flex flex-col lg:flex-row gap-6` and `w-full lg:w-96` on the form to avoid content squishing.

