import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Book } from './pages/Book'
import { BookingSuccess } from './pages/BookingSuccess'
import { AdminResult } from './pages/AdminResult'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/book/success" element={<BookingSuccess />} />
      <Route path="/admin/result" element={<AdminResult />} />
    </Routes>
  )
}

export default App
