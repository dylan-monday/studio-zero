import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Book } from './pages/Book'
import { BookingSuccess } from './pages/BookingSuccess'
import { AdminResult } from './pages/AdminResult'
import { Admin } from './pages/Admin'
import { AdminBooking } from './pages/AdminBooking'
import { AdminCoupons } from './pages/AdminCoupons'
import { AdminCalendar } from './pages/AdminCalendar'
import { HouseRules } from './pages/HouseRules'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/house-rules" element={<HouseRules />} />
      <Route path="/book/success" element={<BookingSuccess />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/booking/:id" element={<AdminBooking />} />
      <Route path="/admin/coupons" element={<AdminCoupons />} />
      <Route path="/admin/calendar" element={<AdminCalendar />} />
      <Route path="/admin/result" element={<AdminResult />} />
    </Routes>
  )
}

export default App
