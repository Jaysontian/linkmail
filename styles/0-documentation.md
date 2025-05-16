# CSS Architecture Documentation

## Overview
The CSS is organized into multiple files to maintain a clear separation of concerns and improve maintainability. Each file serves a specific purpose and contains related styles.

## File Structure

### 1. main.css
Core styles and base components that are used throughout the application.

#### Sections:
- **Core Variables and Base Styles**
  - CSS custom properties (variables)
  - Global color scheme
  - Spacing and sizing variables
  - Transitions and animations

- **Base Layout**
  - Body styles
  - Basic layout structure
  - Container defaults

- **Typography**
  - Font families
  - Text sizes
  - Heading styles
  - Paragraph styles

### 2. ui.css
Shared UI components that are used across different pages.

#### Sections:
- **Form Elements**
  - Input fields
  - Textareas
  - Labels
  - Form groups
  - Form states (focus, hover)

- **Buttons**
  - Primary buttons
  - Secondary buttons
  - Button states (hover, active)
  - Button icons

- **Container**
  - Card containers
  - Modal containers
  - Layout containers

- **Messages and Alerts**
  - Error messages
  - Success messages
  - Placeholder text

- **Tabs**
  - Tab navigation
  - Tab content
  - Active states

- **Dropdowns**
  - Dropdown menus
  - Dropdown items
  - Dropdown states

- **Help Text**
  - Help sections
  - Lists
  - Paragraphs

### 3. dashboard.css
Dashboard-specific styles and components.

#### Sections:
- **Dashboard Layout**
  - Main container
  - Sidebar
  - Content area

- **Navigation**
  - Nav items
  - Active states
  - Icons

- **Email List**
  - Email items
  - Email headers
  - Email previews

- **Email Detail Modal**
  - Modal structure
  - Content layout
  - Close button

- **Experience Cards**
  - Card layout
  - Input fields
  - Remove buttons

- **Skills Section**
  - Input container
  - Tags container
  - Tag items

- **Templates**
  - Template cards
  - Template content
  - Template actions

- **Attachments**
  - Attachment list
  - File items
  - Upload button

## CSS Variables
The following CSS variables are defined in the root and used throughout the application:

```css
:root {
    --primary-color: #0B66C2;
    --primary-hover: #084e96;
    --text-color: #333;
    --text-light: #787878;
    --border-color: rgba(0, 0, 0, 0.15);
    --bg-light: #f7f7f7;
    --bg-light-hover: #f2f2f2;
    --border-radius: 8px;
    --button-radius: 100px;
    --transition: all 0.2s ease;
    --shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}
```


## File Dependencies
- `main.css` should be loaded first as it contains core variables and base styles
- `ui.css` depends on `main.css` for variables and base styles
- `dashboard.css` depends on both `main.css` and `ui.css`

## Maintenance
When adding new styles:
1. Determine if it's a core style, shared component, or page-specific
2. Place it in the appropriate file
3. Add it to the relevant section
4. Use existing variables when possible
5. Follow the established naming conventions
6. Add comments for new sections
