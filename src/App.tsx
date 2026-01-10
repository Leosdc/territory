import TerritoryGame from './components/TerritoryGame'
import { Component, ErrorInfo, ReactNode } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 bg-red-900 text-white font-mono h-screen overflow-auto">
                    <h1 className="text-2xl font-bold mb-4">CRASH DETECTED 💥</h1>
                    <p className="mb-4">Oops! The game crashed. Here is the error:</p>
                    <pre className="bg-black p-4 rounded border border-red-500 whitespace-pre-wrap">
                        {this.state.error?.toString()}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function App() {
    return (
        <ErrorBoundary>
            <div className="w-full h-screen flex items-center justify-center bg-black">
                <TerritoryGame />
            </div>
        </ErrorBoundary>
    )
}

export default App
