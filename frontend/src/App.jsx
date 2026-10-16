import { useState, useEffect } from 'react'

function parseNutritionBreakdown(value) {
  if (!value) return null

  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch (error) {
    console.error('Failed to parse nutrition breakdown:', error)
    return null
  }
}

function NutritionBreakdown({ data }) {
  if (!data?.foods?.length || !data?.total) return null

  const format = value => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—'

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Food nutrition estimates</h3>
        <p className="text-xs text-slate-500 mt-1">Estimated per listed food; totals are for this entry.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {data.foods.map((food, index) => (
          <div key={`${food.name}-${index}`} className="px-4 py-3">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-medium text-slate-800">{food.name}</span>
              <span className="text-slate-500 text-right">{food.amount}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs text-slate-600">
              <span>Calories: {format(food.calories)} kcal</span>
              <span>Protein: {format(food.protein)} g</span>
              <span>Carbs: {format(food.carbs)} g</span>
              <span>Fat: {format(food.fat)} g</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-100">
        <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">Entry total</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-sm font-semibold text-indigo-900">
          <span>{format(data.total.calories)} kcal</span>
          <span>Protein: {format(data.total.protein)} g</span>
          <span>Carbs: {format(data.total.carbs)} g</span>
          <span>Fat: {format(data.total.fat)} g</span>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [heightCm, setHeightCm] = useState(() => localStorage.getItem('heightCm') || 175)
  const [weightKg, setWeightKg] = useState(() => localStorage.getItem('weightKg') || 70)
  const [goal, setGoal] = useState(() => localStorage.getItem('goal') || 'Maintain')
  const [showProfile, setShowProfile] = useState(() => !localStorage.getItem('heightCm'))
  const [showHistory, setShowHistory] = useState(false)

  const [foodInput, setFoodInput] = useState('')
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [latestResult, setLatestResult] = useState(null)

  const backendUrl = 'http://localhost:5000/api/meals';
  const latestNutrition = latestResult ? parseNutritionBreakdown(latestResult.nutritionBreakdown) : null

  useEffect(() => {
    localStorage.setItem('heightCm', heightCm)
    localStorage.setItem('weightKg', weightKg)
    localStorage.setItem('goal', goal)
  }, [heightCm, weightKg, goal])

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch(backendUrl)
      if (res.ok) {
        const data = await res.json()
        setMeals(data)
      }
    } catch (error) {
      console.error("Failed to fetch history:", error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!foodInput.trim()) return

    setLoading(true)
    try {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodInput, heightCm: Number(heightCm), weightKg: Number(weightKg), goal })
      })

      if (res.ok) {
        const newMeal = await res.json()
        setLatestResult(newMeal)
        setFoodInput('')
        fetchHistory()
      } else {
        const errData = await res.json()
        alert("Error: " + (errData.message || "Something went wrong!"))
      }
    } catch (error) {
      console.error("Failed to log meal:", error)
      alert("Error connecting to the backend.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">NutriTrack</span>
          </div>
          <div className="text-sm font-medium text-slate-500">
            Nutrition Intelligence
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        
        {/* Input Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-800">Log Nutrition</h2>
            {!showProfile && (
              <button type="button" onClick={() => setShowProfile(true)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                Edit Profile
              </button>
            )}
          </div>
          
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Profile Toggle Area */}
              {showProfile ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Height (cm)</label>
                    <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" value={heightCm} onChange={e => setHeightCm(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Weight (kg)</label>
                    <input type="number" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" value={weightKg} onChange={e => setWeightKg(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Goal</label>
                    <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow bg-white" value={goal} onChange={e => setGoal(e.target.value)}>
                      <option value="Bulking">Bulking</option>
                      <option value="Cutting">Cutting</option>
                      <option value="Maintain">Maintain</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 flex justify-end mt-1">
                    <button type="button" onClick={() => setShowProfile(false)} className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-4 rounded-md transition-colors">
                      Save Preferences
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span>{heightCm}cm &bull; {weightKg}kg &bull; {goal}</span>
                </div>
              )}

              <div>
                <label htmlFor="food" className="block text-sm font-semibold text-slate-700 mb-2">
                  Dietary Intake
                </label>
                <textarea
                  id="food"
                  rows="3"
                  className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow resize-none"
                  placeholder="Enter what you consumed (e.g., 200g chicken breast, 1 cup rice...)"
                  value={foodInput}
                  onChange={(e) => setFoodInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-md transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </>
                ) : 'Process Entry'}
              </button>
            </form>
          </div>
        </section>

        {/* Result Dashboard */}
        {latestResult && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-800">Analysis Report</h2>
            </div>
            
            <div className="p-6 space-y-6">
              
              <NutritionBreakdown data={latestNutrition} />

              {/* Main Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 bg-white relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Energy Balance</h3>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{latestResult.caloriesAdvice}</p>
                </div>
                
                {latestResult.macroAdvice && (
                  <div className="border border-slate-200 rounded-lg p-4 bg-white relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500"></div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Macronutrient Targets</h3>
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{latestResult.macroAdvice}</p>
                  </div>
                )}
              </div>

              {/* Action Items */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Action Plan</h3>
                <div className="space-y-3">
                  {latestResult.eatMore && latestResult.eatMore.trim() !== '' && (
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="mt-0.5"><svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 uppercase">Increase Intake</h4>
                        <p className="text-sm text-slate-600 mt-1">{latestResult.eatMore}</p>
                      </div>
                    </div>
                  )}
                  
                  {latestResult.eatLess && latestResult.eatLess.trim() !== '' && (
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="mt-0.5"><svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 uppercase">Decrease Intake</h4>
                        <p className="text-sm text-slate-600 mt-1">{latestResult.eatLess}</p>
                      </div>
                    </div>
                  )}
                  
                  {latestResult.activityAdvice && latestResult.activityAdvice.trim() !== '' && (
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div className="mt-0.5"><svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-700 uppercase">Recommended Activity</h4>
                        <p className="text-sm text-slate-600 mt-1">{latestResult.activityAdvice}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* History Toggle Button */}
        <div className="flex justify-center pt-2">
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            {showHistory ? 'Hide Activity Log' : `View Activity Log (${meals.length})`}
          </button>
        </div>

        {/* Right Column: History Feed (Now Full Width & Collapsible) */}
        {showHistory && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in slide-in-from-top-4">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Activity Log</h2>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto p-0">
              {meals.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <p className="text-sm text-slate-500 font-medium">No logs recorded yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Submit an entry to begin tracking.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {meals.map((meal) => (
                    <div key={meal.id} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-sm font-medium text-slate-800 leading-snug pr-4">{meal.foodInput}</p>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 whitespace-nowrap mt-1">
                          {new Date(meal.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <NutritionBreakdown data={parseNutritionBreakdown(meal.nutritionBreakdown)} />
                      </div>

                      <div className="space-y-2 mt-3">
                        {meal.caloriesAdvice && (
                          <div className="text-xs text-slate-600 bg-white border border-slate-200 p-2 rounded flex gap-2">
                            <span className="font-semibold text-slate-700">Energy:</span>
                            <span className="line-clamp-2">{meal.caloriesAdvice}</span>
                          </div>
                        )}
                        {meal.macroAdvice && (
                          <div className="text-xs text-slate-600 bg-white border border-slate-200 p-2 rounded flex gap-2">
                            <span className="font-semibold text-slate-700">Macros:</span>
                            <span className="line-clamp-2">{meal.macroAdvice}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}

export default App
