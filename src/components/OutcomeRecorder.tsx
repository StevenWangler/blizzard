import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { ClipboardText, GithubLogo, ListChecks, PlusCircle, ShieldCheck } from '@phosphor-icons/react'
import { buildOutcomeStats, fetchOutcomeLedger, SnowDayOutcome } from '@/services/outcomes'

const todayISO = () => new Date().toISOString().split('T')[0]

const ghCommandFromForm = (form: OutcomeFormState) => {
  const parts = [
    'gh workflow run log-outcome.yml',
    '--ref development',
    `-f event_date=${form.date}`,
    `-f actual_outcome=${form.outcome}`
  ]

  if (form.notes.trim()) {
    const sanitized = form.notes.replace(/"/g, '\\"')
    parts.push(`-f notes="${sanitized}"`)
  }

  if (form.manualProbability.trim()) {
    parts.push(`-f manual_probability=${form.manualProbability.trim()}`)
  }

  return parts.join(' ')
}

interface OutcomeFormState {
  date: string
  outcome: 'snow-day' | 'school-open'
  notes: string
  manualProbability: string
}

export function OutcomeRecorder() {
  const [outcomes, setOutcomes] = useState<SnowDayOutcome[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<OutcomeFormState>({
    date: todayISO(),
    outcome: 'snow-day',
    notes: '',
    manualProbability: ''
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const ledger = await fetchOutcomeLedger({ bustCache: true })
        setOutcomes(ledger)
      } catch (err) {
        setError('Unable to load existing outcomes. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const stats = useMemo(() => buildOutcomeStats(outcomes), [outcomes])
  const ghCommand = useMemo(() => ghCommandFromForm(form), [form])

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(ghCommand)
      toast.success('GitHub CLI command copied')
    } catch (err) {
      toast.error('Unable to copy command. Copy manually instead.')
    }
  }

  const handleInputChange = (key: keyof OutcomeFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [key]: event.target.value }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={20} />
            Central Outcome Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Blizzard ships as a static application, so we rely on GitHub Actions to append completed snow-day outcomes.
            This page prepares the data you need to run the <code>log-outcome.yml</code> workflow and review the existing ledger.
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Choose the date, actual outcome, and optional notes below.</li>
            <li>Copy the GitHub CLI command (or open the workflow UI) and run it with your maintainer credentials.</li>
            <li>The workflow commits the update to <code>public/data/outcomes.json</code> so everyone sees the result.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle size={20} />
            Prepare Outcome Submission
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Prediction Date</label>
              <Input type="date" value={form.date} onChange={handleInputChange('date')} max={todayISO()} />
            </div>
            <div>
              <label className="text-sm font-medium">Actual Outcome</label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={form.outcome === 'snow-day' ? 'default' : 'outline'}
                  onClick={() => setForm(prev => ({ ...prev, outcome: 'snow-day' }))}
                  className="flex-1"
                >
                  Snow Day
                </Button>
                <Button
                  type="button"
                  variant={form.outcome === 'school-open' ? 'default' : 'outline'}
                  onClick={() => setForm(prev => ({ ...prev, outcome: 'school-open' }))}
                  className="flex-1"
                >
                  School Open
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Student Prediction (optional)</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0-100"
                value={form.manualProbability}
                onChange={handleInputChange('manualProbability')}
                min={0}
                max={100}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={form.notes}
              onChange={handleInputChange('notes')}
              placeholder="Closure timing, conditions, or rationale"
              rows={4}
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <ClipboardText size={18} />
              GitHub CLI Command
            </label>
            <div className="bg-muted rounded-md p-3 text-xs font-mono break-all">
              {ghCommand}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={copyCommand}>Copy Command</Button>
              <Button
                type="button"
                variant="outline"
                asChild
              >
                <a
                  href="https://github.com/StevenWangler/snowday-forecast/actions/workflows/log-outcome.yml"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2"
                >
                  <GithubLogo size={18} />
                  Open Workflow UI
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks size={20} />
            Logged Outcomes ({stats.totalRecords})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-4">{error}</div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading ledger…</p>
          ) : outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outcomes logged yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <Badge variant="outline">Snow Days: {stats.snowDays}</Badge>
                <Badge variant="outline">School Open: {stats.openDays}</Badge>
                <Badge variant="outline">Directional Accuracy: {stats.directionalAccuracy}%</Badge>
                {stats.avgBrierScore !== null && (
                  <Badge variant="outline">Avg Brier: {stats.avgBrierScore}</Badge>
                )}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>AI Prediction</TableHead>
                      <TableHead>Student Prediction</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Recorded By</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outcomes.map(entry => (
                      <TableRow key={`${entry.date}-${entry.recordedAt}`}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {new Date(entry.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {typeof entry.modelProbability === 'number' ? `${entry.modelProbability}%` : '—'}
                          {entry.confidence && (
                            <span className="ml-2 text-xs text-muted-foreground">{entry.confidence}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {typeof entry.studentPrediction === 'number' ? `${entry.studentPrediction}%` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.actualSnowDay === true ? 'destructive' : entry.actualSnowDay === false ? 'secondary' : 'outline'}>
                            {entry.actualSnowDay === true ? 'Snow Day' : entry.actualSnowDay === false ? 'School Open' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="font-medium">{entry.recordedBy}</span>
                            <span className="text-muted-foreground">
                              {new Date(entry.recordedAt).toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md whitespace-normal text-sm">
                          {entry.notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
