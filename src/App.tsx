function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between p-6 bg-white shadow">
        <h1 className="text-2xl font-bold text-blue-600">
          MeToYou
        </h1>

        <div className="space-x-3">
          <button className="px-4 py-2 border rounded-lg">
            Login
          </button>

          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Register
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto text-center py-32 px-4">
        <h1 className="text-5xl font-bold mb-6">
          Find Help. Earn Money.
        </h1>

        <p className="text-xl text-gray-600 mb-10">
          Connect with people nearby for tasks, services,
          and everyday jobs.
        </p>

        <div className="flex justify-center gap-4">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg">
            Find Help
          </button>

          <button className="px-6 py-3 border rounded-lg">
            Earn Money
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;