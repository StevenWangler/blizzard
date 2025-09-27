/**
 * Weather API Debug Component
 * 
 * A debug component to test and display weather API status and data.
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { testWeatherAPI, getDetailedWeatherAnalysis } from '@/lib/weatherTest'
import { WeatherConfigValidator } from '@/lib/weatherErrorHandling'

export function WeatherDebugPanel() {
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])
  const [configStatus, setConfigStatus] = useState<any>(null)

  const runTests = async () => {
    setIsLoading(true)
    setTestResults([])
    
    try {
      // Capture console output
      const originalLog = console.log
      const logs: string[] = []
      console.log = (...args) => {
        logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '))
        originalLog(...args)
      }

      await testWeatherAPI()
      
      // Restore console.log
      console.log = originalLog
      
      setTestResults(logs)
    } catch (error) {
      setTestResults(prev => [...prev, `Error: ${error}`])
    } finally {
      setIsLoading(false)
    }
  }

  const checkConfig = () => {
    const validation = WeatherConfigValidator.validateEnvironment()
    setConfigStatus(validation)
  }

  const getAnalysis = async () => {
    setIsLoading(true)
    try {
      const analysis = await getDetailedWeatherAnalysis()
      setTestResults(prev => [...prev, 'Detailed Analysis:', JSON.stringify(analysis, null, 2)])
    } catch (error) {
      setTestResults(prev => [...prev, `Analysis Error: ${error}`])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weather API Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={checkConfig} variant="outline" size="sm">
            Check Config
          </Button>
          <Button onClick={runTests} disabled={isLoading} size="sm">
            {isLoading ? 'Running Tests...' : 'Run Tests'}
          </Button>
          <Button onClick={getAnalysis} disabled={isLoading} variant="outline" size="sm">
            Get Analysis
          </Button>
          <Button onClick={() => setTestResults([])} variant="ghost" size="sm">
            Clear
          </Button>
        </div>

        {configStatus && (
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={configStatus.isValid ? 'default' : 'destructive'}>
                    {configStatus.isValid ? 'Valid' : 'Invalid'}
                  </Badge>
                  <span>Configuration Status</span>
                </div>
                {configStatus.errors.length > 0 && (
                  <div>
                    <strong>Errors:</strong>
                    <ul className="list-disc list-inside">
                      {configStatus.errors.map((error: string, i: number) => (
                        <li key={i} className="text-sm text-destructive">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {configStatus.warnings.length > 0 && (
                  <div>
                    <strong>Warnings:</strong>
                    <ul className="list-disc list-inside">
                      {configStatus.warnings.map((warning: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {testResults.length > 0 && (
          <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
            <h4 className="font-semibold mb-2">Test Results:</h4>
            <pre className="text-xs whitespace-pre-wrap font-mono">
              {testResults.join('\n')}
            </pre>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>API Key Status:</strong> {import.meta.env.VITE_WEATHER_API_KEY ? 
            (import.meta.env.VITE_WEATHER_API_KEY === 'your_weatherapi_key_here' ? 'Default placeholder' : 'Configured') : 
            'Not set'}</p>
          <p><strong>ZIP Code:</strong> {import.meta.env.VITE_ZIP_CODE || 'Using default (49341)'}</p>
        </div>
      </CardContent>
    </Card>
  )
}