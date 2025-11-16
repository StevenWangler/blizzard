# Snow Day Predictor - Product Requirements Document

An AI-focused snow day prediction platform that combines forecasting models with transparent analysis to predict school closures for Rockford, Michigan.

**Experience Qualities**:
1. **Trustworthy** - Clear methodology and transparent scoring builds confidence in predictions
2. **Engaging** - Visual storytelling, weather-driven theming, and live model diagnostics reward curiosity  
3. **Informative** - Weather drivers and calibration data educate users about forecasting

**Complexity Level**: Light Application (multiple features with basic state)
The app handles predictions, manual outcome logging, scoring, and dashboards but doesn't require complex user accounts or extensive data management.

## Essential Features

### Daily Prediction Display
- **Functionality**: Shows today's snow day probability with visual confidence indicator
- **Purpose**: Primary value - gives users the prediction they came for
- **Trigger**: User visits homepage
- **Progression**: Load → Display probability → Show weather drivers → Explain confidence
- **Success criteria**: Probability loads within 2 seconds, weather data is current

### Manual Outcome Logging  
- **Functionality**: Admins can record whether school closed to finalize each prediction
- **Purpose**: Allows the accuracy dashboard to function without backend automation
- **Trigger**: Outcome becomes known for a tracked date
- **Progression**: View pending record → Select outcome → Update accuracy metrics
- **Success criteria**: Entry is stored locally, dashboard recalculates immediately

### Accuracy Tracking & Scoring
- **Functionality**: Tracks predictions vs outcomes using Brier scores
- **Purpose**: Validates prediction quality and ranks forecaster performance  
- **Trigger**: Daily resolution when school decision is known
- **Progression**: Outcome recorded → Scores calculated → Leaderboards updated → History logged
- **Success criteria**: Scores are mathematically correct, trends show improvement

### Weather Data Integration
- **Functionality**: Fetches forecast data to drive model predictions
- **Purpose**: Provides transparent basis for predictions and educational value
- **Trigger**: Scheduled refresh (2x daily) or user request
- **Progression**: API call → Parse relevant fields → Generate prediction → Display drivers
- **Success criteria**: Data is current, relevant fields extracted, prediction logic is sound

### Accuracy Dashboard
- **Functionality**: Highlights model calibration, recent results, and dataset health
- **Purpose**: Communicates how reliable the AI forecast has been
- **Trigger**: User opens Accuracy tab or records new outcome
- **Progression**: Display stats → Show Brier trend → List recent predictions
- **Success criteria**: Metrics update instantly, charts remain legible on mobile

## Edge Case Handling
- **No weather data**: Show last known data with timestamp and refresh option
- **School closure ambiguity**: Admin override capability for unusual circumstances  
- **Manual outcome backlog**: Highlight pending records that still need a result
- **Confidence communication**: Show uncertainty range, emphasize probabilistic nature
- **API rate limits**: Cache data appropriately, graceful degradation messaging

## Design Direction
The design should feel scientific yet approachable - like a weather service meets prediction market. Clean, data-driven interface with weather-appropriate color palette that conveys both accuracy and community spirit.

## Color Selection
Analogous (adjacent colors on color wheel) - using cool blues to whites that evoke winter weather while maintaining professional credibility for forecast data.

- **Primary Color**: Deep Winter Blue (oklch(0.4 0.15 240)) - conveys trust and weather relevance
- **Secondary Colors**: Ice Blue (oklch(0.85 0.05 240)) for backgrounds, Steel Blue (oklch(0.55 0.1 240)) for secondary actions
- **Accent Color**: Bright Snow Orange (oklch(0.7 0.15 60)) for CTAs and important alerts
- **Foreground/Background Pairings**: 
  - Background (Ice Blue): Dark Navy text (oklch(0.2 0.1 240)) - Ratio 7.2:1 ✓
  - Primary (Deep Winter Blue): White text (oklch(1 0 0)) - Ratio 6.8:1 ✓  
  - Accent (Snow Orange): Dark Navy text (oklch(0.2 0.1 240)) - Ratio 5.1:1 ✓

## Font Selection
Modern, clean sans-serif that balances scientific precision with approachable community feel - Inter for its excellent readability across data displays and proven performance in prediction interfaces.

- **Typographic Hierarchy**: 
  - H1 (Daily Probability): Inter Bold/48px/tight letter spacing
  - H2 (Section Headers): Inter Semibold/24px/normal spacing  
  - Body (Descriptions): Inter Regular/16px/relaxed line height
  - Data (Scores/Numbers): Inter Medium/18px/tabular figures

## Animations
Subtle, weather-inspired transitions that reinforce the forecasting theme - gentle fades and slides that feel like shifting weather patterns rather than jarring interface changes.

- **Purposeful Meaning**: Snow-like gentle transitions convey the gradual nature of weather changes and prediction updates
- **Hierarchy of Movement**: Probability updates get prominent animation, manual actions feel responsive, data loads smoothly

## Component Selection
- **Components**: Card for prediction display, Progress for probability bars, Badge for accuracy indicators, Tabs for navigation between views, Buttons for manual outcome entry, Charts for calibration, Alert for weather warnings
- **Customizations**: Weather-themed progress bars, probability visualization components, calibration chart containers
- **States**: Outcome buttons show clear selected states, prediction cards indicate confidence levels, disabled states for past predictions  
- **Icon Selection**: Phosphor weather icons (Cloud, Sun, Thermometer) plus accuracy cues (Target, TrendUp)
- **Spacing**: Generous padding (p-6/p-8) for main content, tight spacing (gap-2) for related data points
- **Mobile**: Stack prediction data vertically, collapse detailed weather drivers to expandable sections, keep manual controls large
