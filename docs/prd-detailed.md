# Snow Day Predictor - Product Requirements Document

## Core Purpose & Success

**Mission Statement**: Create a fun, trustworthy web application that predicts snow day school closures for Rockford, Michigan by combining AI model predictions with transparent weather analysis.

**Success Indicators**: 
- High user engagement with daily predictions and follow-up accuracy checks
- Accurate predictions that improve as data is logged over time
- Timely manual outcome logging so the dashboard stays current

**Experience Qualities**: Trustworthy, Engaging, Collaborative

## Project Classification & Approach

**Complexity Level**: Light Application (multiple features with basic state management)

**Primary User Activity**: Interacting - users consume predictions, review context, and record outcomes for accuracy tracking

## Core Problem Analysis

**Specific Problem**: Parents, students, and school staff need reliable advance notice of snow day school closures, but traditional weather forecasts don't account for local school district decision-making patterns.

**User Context**: Users check the app daily during winter months, typically evening before or morning of potential snow days.

**Critical Path**: View today's prediction → Understand confidence level → Check latest school outcome → Track accuracy over time

**Key Moments**: 
1. Daily prediction reveal with clear probability
2. Insight into why the model chose its probability
3. Recording the real outcome and seeing accuracy update

## Essential Features

### Today's Forecast View
- **Functionality**: Display AI model probability, weather drivers, and agent rationale
- **Purpose**: Provide at-a-glance prediction with supporting context
- **Success Criteria**: Users can quickly understand likelihood and reasoning

### Manual Outcome Logging
- **Functionality**: Simple controls to mark whether school ultimately closed
- **Purpose**: Keep the accuracy dashboard current without backend infrastructure
- **Success Criteria**: Pending records are easy to resolve and instantly recalculate stats

### Accuracy Tracking
- **Functionality**: Brier scores, calibration plots, recent prediction summaries
- **Purpose**: Build trust through transparent performance metrics
- **Success Criteria**: Users understand and trust the prediction quality

### Historical Analysis
- **Functionality**: Timeline of past predictions vs. outcomes
- **Purpose**: Learn from patterns and validate system performance
- **Success Criteria**: Clear trends and insights visible to users

### Dark Mode Support
- **Functionality**: Light/dark/system theme toggle
- **Purpose**: Better viewing experience in different lighting conditions
- **Success Criteria**: Seamless theme switching with preference persistence

## Design Direction

### Visual Tone & Identity
**Emotional Response**: Confident, reliable, and approachable - like checking a trusted weather app with extra transparency
**Design Personality**: Clean and data-focused with just enough warmth to feel human
**Visual Metaphors**: Weather patterns, probability distributions, forecast timelines
**Simplicity Spectrum**: Minimal interface that surfaces key data clearly without overwhelming complexity

### Color Strategy
**Color Scheme Type**: Analogous (cool blues and whites evoking winter/snow)
**Primary Color**: Deep winter blue (oklch(0.4 0.15 240)) - trustworthy and weather-appropriate
**Secondary Colors**: Light snow blue (oklch(0.85 0.05 240)) for backgrounds and secondary actions  
**Accent Color**: Warm amber (oklch(0.7 0.15 60)) for highlights and success states
**Color Psychology**: Blues convey trust and reliability; amber provides warmth and optimism
**Color Accessibility**: All combinations meet WCAG AA standards with 4.5:1+ contrast ratios
**Dark Mode**: Complete dark theme with inverted luminance while maintaining color relationships

### Typography System
**Font Pairing Strategy**: Single font family (Inter) with varied weights for hierarchy
**Typographic Hierarchy**: Bold headlines, medium weights for UI, regular for body text
**Font Personality**: Modern, readable, technical but friendly
**Readability Focus**: Optimized for quick scanning of numerical data and probabilities
**Typography Consistency**: Consistent scale and spacing throughout interface

### Visual Hierarchy & Layout
**Attention Direction**: Large probability display draws focus, followed by analysis cards and accuracy insights
**White Space Philosophy**: Generous spacing creates calm, focused experience
**Grid System**: Card-based layout with consistent spacing and alignment
**Responsive Approach**: Mobile-first with stacked cards, desktop with grid layout
**Content Density**: Balanced - enough detail to inform without overwhelming

### Animations
**Purposeful Meaning**: Subtle transitions reinforce state changes and guide attention
**Hierarchy of Movement**: Probability updates and manual actions get micro-animations
**Contextual Appropriateness**: Weather-appropriate subtle movements, no flashy effects

### UI Elements & Component Selection
**Component Usage**: 
- Cards for prediction display and data grouping
- Tabs for main navigation between views
- Badges for status indicators and probabilities
- Progress bars for visual probability representation
- Buttons for manual outcome actions
- Dropdown menu for theme selection

**Component Customization**: Consistent border radius (0.75rem) and winter color palette
**Component States**: Clear hover/active states for all interactive elements
**Icon Selection**: Phosphor icons for consistent, clean iconography
**Mobile Adaptation**: Stacked layout with larger touch targets and simplified navigation

### Theme Implementation
**Light Theme**: Clean whites and light blues with dark text
**Dark Theme**: Deep blues and grays with light text, maintaining readability
**System Theme**: Automatically follows user's OS preference
**Theme Toggle**: Accessible dropdown with sun/moon/monitor icons

## Edge Cases & Problem Scenarios

**Potential Obstacles**: 
- Weather API failures or rate limits
- Forgetting to record actual school outcomes
- False predictions damaging trust

**Edge Case Handling**:
- Graceful degradation when weather data unavailable
- Clear uncertainty communication when confidence is low
- Historical context to maintain perspective on prediction accuracy

## Implementation Considerations

**Scalability Needs**: Persistent storage for weather data, user preferences, and logged outcomes
**Testing Focus**: Prediction accuracy over time, user engagement metrics
**Critical Questions**: How to automate outcome ingestion and keep predictions fresh without a backend?

## Reflection

This approach pairs reliable weather models with transparent reporting so families can see not just the forecast, but how well it performed after the fact—building trust even without complex backend systems.
