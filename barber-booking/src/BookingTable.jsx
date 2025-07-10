import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import BookingForm from './BookingForm';

export default function BookingTable() {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'slots'), (snapshot) => {
      const fetchedSlots = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSlots(fetchedSlots);
    });

    return () => unsubscribe();
  }, []);

 const handleBooking = async (slotId, formData) => {
  if (formData.payment === "cash") {
    const slotRef = doc(db, 'slots', slotId);
    await updateDoc(slotRef, {
      status: 'booked',
      customerName: formData.name,
      customerPhone: formData.phone,
      paymentType: 'cash',
    });
    setSelectedSlot(null);
  } else if (formData.payment === "card") {
    try {
      const response = await fetch('https://your-backend-url.onrender.com/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          time: selectedSlot.time,
          customerName: formData.name,
          customerPhone: formData.phone,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location = data.url; // Redirect to Stripe Checkout
      } else {
        alert("Failed to create Stripe session.");
      }
    } catch (err) {
      console.error("Stripe booking error:", err);
      alert("Something went wrong. Please try again.");
    }
  }
};


  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Available Time Slots</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Time Slot</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Action</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} className="text-center">
              <td className="p-2 border">{slot.time}</td>
              <td className="p-2 border">
                {slot.status === "available" ? "✅ Available" : "❌ Booked"}
              </td>
              <td className="p-2 border">
                {slot.status === "available" ? (
                  <button
                    className="bg-blue-500 text-white px-4 py-1 rounded"
                    onClick={() => setSelectedSlot(slot)}
                  >
                    Book Now
                  </button>
                ) : (
                  <button className="bg-gray-300 text-gray-600 px-4 py-1 rounded" disabled>
                    Not Available
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedSlot && (
        <BookingForm
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSubmit={(formData) => handleBooking(selectedSlot.id, formData)}
        />
      )}
    </div>
  );
}
