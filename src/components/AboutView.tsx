import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentPageHeading } from '@/components/StudentPageHeading'
import { ForecastMusicCredits } from '@/components/ForecastMusicControl'
import { 
  Clock, 
  Brain, 
  Target, 
  UsersThree, 
  GithubLogo,
  Lightning,
  ChartLine
} from '@phosphor-icons/react'

export function AboutView() {
  return (
    <div className="student-page about-page space-y-6 sm:space-y-8 relative z-10">
      <StudentPageHeading title="About Blizzard" description="A snow-day forecast for the Rockford Rams." />
      <p className="border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">
        Blizzard estimates the chance of a snow day. It is not an official district announcement;
        Rockford Public Schools makes the final call.
      </p>

      <ForecastMusicCredits />

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
                  <p className="font-medium">Three scheduled runs</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Forecasts are scheduled three times a day while Blizzard is active.
                  </p>
                  <p className="text-muted-foreground text-xs mt-1 italic">
                    Runs can be delayed or fail. Check the forecast’s update time.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <ChartLine size={18} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Fresh Weather Data</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Each successful run uses newly fetched weather data.
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
                One forecaster reads the weather for Rockford’s next school morning. It can check dated public reports when ice, road conditions or extreme cold could change the call.
              </p>
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
                <span className="text-primary tabular-nums">01</span> Data Collection
              </h4>
              <p className="text-muted-foreground text-xs">
                Weather APIs provide current conditions, forecasts, precipitation, wind, and temperature data
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-primary tabular-nums">02</span> Morning travel
              </h4>
              <p className="text-muted-foreground text-xs">
                The forecaster weighs overnight accumulation and freezing against the time buses head out.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border/60 bg-card/80">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-primary tabular-nums">03</span> Final Prediction
              </h4>
              <p className="text-muted-foreground text-xs">
                Blizzard publishes the estimated chance of closure, the main reasons and how confident the forecaster is.
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
              href="https://github.com/StevenWangler/blizzard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
