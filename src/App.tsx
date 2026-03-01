import { Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Book } from './pages/Book'
import { BookingSuccess } from './pages/BookingSuccess'
import { AdminResult } from './pages/AdminResult'
import { Admin } from './pages/Admin'
import { AdminBooking } from './pages/AdminBooking'
import { AdminCoupons } from './pages/AdminCoupons'
import { AdminCalendar } from './pages/AdminCalendar'
import { AdminEmails } from './pages/AdminEmails'
import { HouseRules } from './pages/HouseRules'
import { AdminAuth } from './components/admin/AdminAuth'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/house-rules" element={<HouseRules />} />
      <Route path="/book/success" element={<BookingSuccess />} />
      {/* Admin routes — protected by auth */}
      <Route element={<AdminAuth />}>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/booking/:id" element={<AdminBooking />} />
        <Route path="/admin/coupons" element={<AdminCoupons />} />
        <Route path="/admin/calendar" element={<AdminCalendar />} />
        <Route path="/admin/emails" element={<AdminEmails />} />
      </Route>
      {/* Admin result page — accessed from email links, no auth */}
      <Route path="/admin/result" element={<AdminResult />} />
    </Routes>
  )
}

export default App
