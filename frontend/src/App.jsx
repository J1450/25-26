import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainPage />} />
                <Route path="/code/asystole" element={<AsystolePage />} />
                <Route path="/code/ventfib" element={<VentFibPage />} />
                <Route path="/code/normalsinus" element={<NormalSinusPage />} />
                <Route path="/code/summary" element={<SummaryPage />} />
            </Routes>
        </BrowserRouter>
    )
}
