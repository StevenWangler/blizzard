import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  Brain, 
  CloudSnow, 
  Target, 
  UsersThree, 
  GithubLogo,
  Lightning,
  ChartLine,
  MapPin
} from '@phosphor-icons/react'

export function AboutView() {
  return (
    <div className="space-y-8 relative z-10">
      {/* Hero Section */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <CloudSnow size={48} className="text-primary" weight="duotone" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Snow Day Predictor</CardTitle>
          <p className="text-muted-foreground mt-2">
            AI-powered snow day predictions for Rockford, Michigan
          </p>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <MapPin size={12} className="mr-1" />
              Rockford, MI
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Brain size={12} className="mr-1" />
              Multi-Agent AI
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Target size={12} className="mr-1" />
              Brier Scoring
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock size={20} className="text-primary" />
              When It Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Lightning size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">3 Times Daily</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Predictions run automatically at 9 AM, 1 PM, and 6 PM EST via GitHub Actions
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 italic">
                    Note: GitHub Actions scheduling can vary by 15–60 minutes depending on runner availability
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <ChartLine size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Fresh Weather Data</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Each run fetches the latest conditions and forecasts from weather APIs to keep predictions current
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain size={20} className="text-primary" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                The system uses a multi-agent AI architecture with specialized experts:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span><strong>Chief Meteorologist</strong> — analyzes weather conditions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span><strong>Weather Historian</strong> — provides historical context</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span><strong>Safety Analyst</strong> — evaluates travel conditions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span><strong>Decision Coordinator</strong> — synthesizes the final prediction</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prediction Logic */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersThree size={20} className="text-primary" />
            Prediction Logic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-lg">1️⃣</span> Data Collection
              </h4>
              <p className="text-muted-foreground text-xs">
                Weather APIs provide current conditions, forecasts, precipitation, wind, and temperature data
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-lg">2️⃣</span> Expert Analysis
              </h4>
              <p className="text-muted-foreground text-xs">
                AI agents analyze data in parallel, each applying their specialized knowledge to assess snow day likelihood
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-lg">3️⃣</span> Final Prediction
              </h4>
              <p className="text-muted-foreground text-xs">
                The Decision Coordinator weighs all inputs and produces a probability with confidence level and detailed reasoning
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accuracy & Scoring */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target size={20} className="text-primary" />
            Accuracy & Scoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We track prediction accuracy using the <strong>Brier Score</strong>, a standard measure for probabilistic forecasts:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2">What is a Brier Score?</h4>
              <p className="text-muted-foreground text-xs">
                It measures the accuracy of probabilistic predictions. Lower is better — a perfect score is 0, and random guessing scores around 0.25.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2">How We Track Results</h4>
              <p className="text-muted-foreground text-xs">
                After each school day, the actual outcome (snow day or not) is recorded. This allows us to calculate accuracy over time and improve the model.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer / Links */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                Built with ❄️ for the Rockford community
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Powered by OpenAI Agents SDK and WeatherAPI
              </p>
            </div>
            <a 
              href="https://github.com/StevenWangler/snowday-forecast"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <GithubLogo size={20} />
              <span>View on GitHub</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
