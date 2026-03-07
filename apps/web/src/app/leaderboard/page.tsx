export default function LeaderboardPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>

      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="text-left p-4 font-medium">#</th>
              <th className="text-left p-4 font-medium">Player</th>
              <th className="text-right p-4 font-medium">ELO</th>
              <th className="text-right p-4 font-medium">W/L</th>
              <th className="text-right p-4 font-medium">Won</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-12 text-center text-text-muted">
                No players yet. Be the first!
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
