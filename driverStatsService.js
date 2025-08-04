// driverStatsService.js - MODIFIED VERSION
import { db } from './firebaseConfig';
import {
  doc,
  updateDoc,
  increment,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  limit,
  orderBy // Import orderBy for proper sorting in Firestore
} from 'firebase/firestore';

// Initialize driver statistics document when driver first registers
export const initializeDriverStats = async (driverId, driverData = {}) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const driverDoc = await getDoc(driverRef);

    if (!driverDoc.exists()) {
      await setDoc(driverRef, {
        name: driverData.name || '',
        email: driverData.email || '',
        phone: driverData.phone || '',
        vehicleInfo: driverData.vehicleInfo || {},

        totalTrips: 0,
        totalEarnings: 0,
        averageRating: 0,
        totalRatings: 0,
        ratingSum: 0,
        completedTrips: 0,
        cancelledTrips: 0,

        weeklyEarnings: 0,
        monthlyEarnings: 0,
        completionRate: 100,

        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),

        isActive: true,
        isOnline: false
      });

      console.log('Driver stats initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing driver stats:', error);
    throw error;
  }
};

export const updateDriverStatsOnTripCompletion = async (driverId, tripData) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const batch = writeBatch(db);

    batch.update(driverRef, {
      totalTrips: increment(1),
      completedTrips: increment(1),
      totalEarnings: increment(tripData.fare || 0),
      lastActive: serverTimestamp()
    });

    // We are still writing to the 'trips' collection here as per original design,
    // which is separate from the 'rides' collection shown in your screenshot.
    // If 'trips' is meant to be 'rides', this function needs adjustment.
    const tripRef = doc(collection(db, 'trips'));
    batch.set(tripRef, {
      driverId,
      passengerId: tripData.passengerId,
      fare: tripData.fare || 0,
      distance: tripData.distance || 0,
      duration: tripData.duration || 0,
      startLocation: tripData.startLocation,
      endLocation: tripData.endLocation,
      status: 'completed',
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    await batch.commit();
    await recalculateCompletionRate(driverId);
    await updateMonthlyEarnings(driverId, tripData.fare || 0);
    console.log('Trip completion stats updated');

  } catch (error) {
    console.error('Error updating driver stats:', error);
    throw error;
  }
};

export const updateDriverStatsOnTripCancellation = async (driverId, tripData) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const batch = writeBatch(db);

    batch.update(driverRef, {
      totalTrips: increment(1),
      cancelledTrips: increment(1),
      lastActive: serverTimestamp()
    });

    // Similarly, writing to 'trips' collection here.
    const tripRef = doc(collection(db, 'trips'));
    batch.set(tripRef, {
      driverId,
      passengerId: tripData.passengerId || null,
      status: 'cancelled',
      cancellationReason: tripData.cancellationReason || '',
      cancelledBy: tripData.cancelledBy || 'driver',
      cancelledAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    await batch.commit();
    await recalculateCompletionRate(driverId);
    console.log('Trip cancellation stats updated');

  } catch (error) {
    console.error('Error updating cancellation stats:', error);
    throw error;
  }
};

export const updateDriverRating = async (driverId, rating, comment = '') => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const driverDoc = await getDoc(driverRef);

    if (!driverDoc.exists()) {
      throw new Error('Driver not found');
    }

    const currentData = driverDoc.data();
    const newTotalRatings = (currentData.totalRatings || 0) + 1;
    const newRatingSum = (currentData.ratingSum || 0) + rating;
    const newAverageRating = newRatingSum / newTotalRatings;

    const batch = writeBatch(db);

    batch.update(driverRef, {
      totalRatings: newTotalRatings,
      ratingSum: newRatingSum,
      averageRating: Number(newAverageRating.toFixed(2))
    });

    const ratingRef = doc(collection(db, 'ratings'));
    batch.set(ratingRef, {
      driverId,
      rating,
      comment,
      createdAt: serverTimestamp()
    });

    await batch.commit();
    console.log('Driver rating updated');

  } catch (error) {
    console.error('Error updating driver rating:', error);
    throw error;
  }
};

export const getDriverStatistics = async (driverId) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const driverDoc = await getDoc(driverRef);

    if (!driverDoc.exists()) {
      await initializeDriverStats(driverId);
      return {
        totalTrips: 0,
        totalEarnings: 0,
        averageRating: 0,
        completionRate: 100,
        totalRatings: 0,
        completedTrips: 0,
        cancelledTrips: 0,
        monthlyEarnings: 0,
        monthlyTrips: 0
      };
    }

    const data = driverDoc.data();

    return {
      totalTrips: data.totalTrips || 0,
      totalEarnings: data.totalEarnings || 0,
      averageRating: data.averageRating || 0,
      completionRate: data.completionRate || 100,
      totalRatings: data.totalRatings || 0,
      completedTrips: data.completedTrips || 0,
      cancelledTrips: data.cancelledTrips || 0,
      monthlyEarnings: data.monthlyEarnings || 0,
      monthlyTrips: data.monthlyTrips || 0,
      name: data.name || '',
      email: data.email || '',
      isActive: data.isActive || false,
      lastActive: data.lastActive
    };
  } catch (error) {
    console.error('Error fetching driver statistics:', error);
    throw error;
  }
};

const recalculateCompletionRate = async (driverId) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const driverDoc = await getDoc(driverRef);

    if (driverDoc.exists()) {
      const data = driverDoc.data();
      const completed = data.completedTrips || 0;
      const cancelled = data.cancelledTrips || 0;
      const total = completed + cancelled;
      const completionRate = total > 0 ? (completed / total) * 100 : 100;

      await updateDoc(driverRef, {
        completionRate: Number(completionRate.toFixed(2))
      });
    }
  } catch (error) {
    console.error('Error recalculating completion rate:', error);
  }
};

const updateMonthlyEarnings = async (driverId, fareAmount) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const driverDoc = await getDoc(driverRef);

    if (driverDoc.exists()) {
      const data = driverDoc.data();
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const lastUpdate = data.lastMonthlyUpdate?.toDate() || new Date(0);
      const lastUpdateMonth = lastUpdate.getMonth();
      const lastUpdateYear = lastUpdate.getFullYear();

      let monthlyEarnings = data.monthlyEarnings || 0;
      let monthlyTrips = data.monthlyTrips || 0;

      if (currentMonth !== lastUpdateMonth || currentYear !== lastUpdateYear) {
        monthlyEarnings = 0;
        monthlyTrips = 0;
      }

      await updateDoc(driverRef, {
        monthlyEarnings: monthlyEarnings + fareAmount,
        monthlyTrips: monthlyTrips + 1,
        lastMonthlyUpdate: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating monthly earnings:', error);
  }
};

// Renamed original getRecentTrips for clarity if 'trips' collection is still used
export const getRecentTripsFromTripsCollection = async (driverId, limitCount = 10) => {
  try {
    const tripsRef = collection(db, 'trips');
    const q = query(
      tripsRef,
      where('driverId', '==', driverId),
      limit(30) // get more, sort locally
    );

    const querySnapshot = await getDocs(q);

    const trips = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(trip => trip.createdAt)
      .sort((a, b) => (b.createdAt.toMillis?.() || 0) - (a.createdAt.toMillis?.() || 0))
      .slice(0, limitCount);

    return trips;
  } catch (error) {
    console.error('Error fetching recent trips from "trips" collection:', error);
    return [];
  }
};

// NEW FUNCTION: Fetch recent rides from the 'rides' collection
export const getRecentRidesFromRidesCollection = async (driverId, limitCount = 15) => {
  try {
    const ridesRef = collection(db, 'rides');
    const q = query(
      ridesRef,
      where('acceptedBy', '==', driverId), // 'acceptedBy' is the driverId in the 'rides' collection
      orderBy('startTime', 'desc'), // Assuming 'startTime' is the timestamp for ordering
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);

    const rides = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // IMPORTANT: For this query (where + orderBy), you'll likely need a Firestore composite index.
    // Firestore will typically suggest creating this index in your console if it's missing when you run the query.
    // The index would be on: Collection: 'rides', Fields: acceptedBy (Asc), startTime (Desc)

    return rides;
  } catch (error) {
    console.error('Error fetching recent rides from "rides" collection:', error);
    return [];
  }
};

export const resetMonthlyStats = async (driverId) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    await updateDoc(driverRef, {
      monthlyEarnings: 0,
      monthlyTrips: 0,
      lastMonthlyUpdate: serverTimestamp()
    });
    console.log('Monthly stats reset');
  } catch (error) {
    console.error('Error resetting monthly stats:', error);
  }
};