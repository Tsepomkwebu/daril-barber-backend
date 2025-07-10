// src/BookingForm.jsx
import React, { useState } from 'react';

export default function BookingForm({ slot, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('cash');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name, phone, payment });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-[300px]">
        <h2 className="text-lg font-bold mb-4">Book {slot.time}</h2>
        <form onSubmit={handleSubmit}>
          <input
            className="w-full mb-2 border p-2 rounded"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full mb-2 border p-2 rounded"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <select
            className="w-full mb-4 border p-2 rounded"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
          <button type="submit" className="bg-green-600 text-white w-full p-2 rounded">Confirm Booking</button>
        </form>
        <button onClick={onClose} className="text-sm text-blue-500 mt-2 underline">Cancel</button>
      </div>
    </div>
  );
}
