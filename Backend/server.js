/**
 * Dukatrack: Delivery Coordination MVP — Express + Socket.io Server
 * 
 * ARCHITECTURAL DESIGN & PROOF-OF-DELIVERY PATTERN:
 * In traditional delivery applications, the current status is merely a mutable column (e.g. `status = 'DELIVERED'`).
 * However, in Dukatrack, every single status change writes an immutable `StatusEvent` row inside the exact same database
 * transaction as the status update.
 * 
 * WHY IS THIS MANDATORY?
 * 1. Auditability & Proof of Delivery: Small Kenyan retailers require an unalterable log proving WHEN, WHO, and HOW
 *    a package changed hands (e.g., manual update vs verified QR scan).
 * 2. Real-time Synchronization: Emitting targeted Socket.io events immediately after a successful transaction keeps
 *    Retailer, Dispatcher, and Rider screens in sync without aggressive polling.
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for dev simplicity between ports
    methods: ['GET', 'POST'],
  },
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================================
// SOCKET.IO REAL-TIME ROOM MANAGEMENT
// ============================================================================
// Socket rooms allow targeted updates instead of broadcasting every action to all users.
// - `dispatchers`: All dispatcher clients join this room to see incoming delivery requests.
// - `rider_<id>`: Each rider joins their own specific room to receive private assignment alerts.
// - `retailer_<id>`: Retailers join to track their specific package status updates.

io.on('connection', (socket) => {
  console.log(`[Socket] New client connected: ${socket.id}`);

  // Handle explicit room joins when user selects or switches roles
  socket.on('join_room', ({ role, userId }) => {
    // Leave all previous custom rooms to prevent duplicate room joins
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    if (role === 'dispatcher') {
      socket.join('dispatchers');
      console.log(`[Socket] Client ${socket.id} joined room: dispatchers`);
    } else if (role === 'rider' && userId) {
      const room = `rider_${userId}`;
      socket.join(room);
      console.log(`[Socket] Client ${socket.id} joined room: ${room}`);
    } else if (role === 'retailer' && userId) {
      const room = `retailer_${userId}`;
      socket.join(room);
      console.log(`[Socket] Client ${socket.id} joined room: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});


// ============================================================================
// REST API ROUTES
// ============================================================================

/**
 * GET /users
 * Fetch all users or filter by role (e.g. ?role=rider) for UI dropdowns
 */
app.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const whereClause = role ? { role } : {};
    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /requests?role=X&userId=Y
 * Returns role-specific delivery request list:
 * - Retailer: Sees their own requests (retailer_id === userId)
 * - Dispatcher: Sees open REQUESTED requests (and all active requests for dashboard)
 * - Rider: Sees requests assigned to them (assigned_rider_id === userId)
 */
app.get('/requests', async (req, res) => {
  try {
    const { role, userId } = req.query;
    let whereClause = {};

    if (role === 'retailer' && userId) {
      whereClause = { retailer_id: userId };
    } else if (role === 'dispatcher') {
      // Dispatcher sees all requests, prioritised by newest
      whereClause = {};
    } else if (role === 'rider' && userId) {
      whereClause = { assigned_rider_id: userId };
    }

    const requests = await prisma.deliveryRequest.findMany({
      where: whereClause,
      include: {
        retailer: true,
        assigned_rider: true,
        status_events: {
          orderBy: { timestamp: 'desc' },
          include: { actor: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch delivery requests' });
  }
});

/**
 * GET /requests/:id/qr
 * Generates a Data URL image of the QR Code for a given delivery's unique token.
 */
app.get('/requests/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id },
    });

    if (!delivery) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    // Generate QR code data URL from the unique token
    const qrDataUrl = await QRCode.toDataURL(delivery.qr_code_token, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
    });

    res.json({
      deliveryId: delivery.id,
      token: delivery.qr_code_token,
      qrDataUrl,
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

/**
 * POST /requests
 * Retailer creates a new delivery request.
 * - Generates unique `qr_code_token`
 * - Sets status = REQUESTED
 * - Writes initial StatusEvent in the SAME database transaction
 * - Broadcasts `new_request` to all connected Dispatchers via Socket.io room `dispatchers`
 */
app.post('/requests', async (req, res) => {
  try {
    const { retailer_id, customer_name, customer_phone, customer_address, item_description } = req.body;

    if (!retailer_id || !customer_name || !customer_phone || !customer_address || !item_description) {
      return res.status(400).json({ error: 'All fields are required: retailer_id, customer_name, customer_phone, customer_address, item_description' });
    }

    // Generate a unique human-friendly token for QR code encoding
    const qr_code_token = `DUKATRACK-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Execute atomic transaction: DeliveryRequest creation + initial StatusEvent
    const [delivery] = await prisma.$transaction(async (tx) => {
      const newDelivery = await tx.deliveryRequest.create({
        data: {
          retailer_id,
          customer_name,
          customer_phone,
          customer_address,
          item_description,
          status: 'REQUESTED',
          qr_code_token,
        },
        include: {
          retailer: true,
          assigned_rider: true,
          status_events: true,
        },
      });

      // Immutable Proof-of-Delivery log entry
      await tx.statusEvent.create({
        data: {
          delivery_id: newDelivery.id,
          from_status: null,
          to_status: 'REQUESTED',
          actor_id: retailer_id,
          actor_role: 'retailer',
          method: 'manual_update',
        },
      });

      return [newDelivery];
    });

    // Real-time Push: Notify dispatchers room of the newly created delivery request
    io.to('dispatchers').emit('new_request', delivery);
    // Also notify the retailer's own room so any connected retailer screens update
    io.to(`retailer_${retailer_id}`).emit('status_updated', delivery);

    console.log(`[Delivery Created] ID: ${delivery.id} | Token: ${qr_code_token}`);
    res.status(201).json(delivery);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to create delivery request' });
  }
});

/**
 * POST /requests/:id/assign
 * Dispatcher assigns a rider to a delivery request.
 * Body: { riderId, dispatcherId }
 * - Sets status = ASSIGNED and assigned_rider_id
 * - Writes StatusEvent
 * - Emits `assigned` event directly to rider's room `rider_<riderId>` (targeted push)
 */
app.post('/requests/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { riderId, dispatcherId } = req.body;

    if (!riderId || !dispatcherId) {
      return res.status(400).json({ error: 'Both riderId and dispatcherId are required' });
    }

    const currentDelivery = await prisma.deliveryRequest.findUnique({
      where: { id },
    });

    if (!currentDelivery) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    const previousStatus = currentDelivery.status;

    // Transactionally update status & record audit log
    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRequest.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          assigned_rider_id: riderId,
        },
        include: {
          retailer: true,
          assigned_rider: true,
          status_events: {
            orderBy: { timestamp: 'desc' },
            include: { actor: true },
          },
        },
      });

      await tx.statusEvent.create({
        data: {
          delivery_id: id,
          from_status: previousStatus,
          to_status: 'ASSIGNED',
          actor_id: dispatcherId,
          actor_role: 'dispatcher',
          method: 'manual_update',
        },
      });

      return updated;
    });

    // Targeted Socket.io emitting:
    // 1. Emit to the specific rider's room (`rider_<id>`) so they get assigned alert
    io.to(`rider_${riderId}`).emit('assigned', updatedDelivery);
    // 2. Emit to retailer's room so retailer sees live status change
    io.to(`retailer_${updatedDelivery.retailer_id}`).emit('status_updated', updatedDelivery);
    // 3. Emit to dispatchers room so all dispatchers see assigned update
    io.to('dispatchers').emit('status_updated', updatedDelivery);

    console.log(`[Delivery Assigned] ID: ${id} -> Rider: ${riderId}`);
    res.json(updatedDelivery);
  } catch (error) {
    console.error('Error assigning rider:', error);
    res.status(500).json({ error: 'Failed to assign rider' });
  }
});

/**
 * POST /requests/:id/status
 * Rider updates status manually (e.g. PICKED_UP).
 * Body: { newStatus, riderId }
 * 
 * CONSTRAINT ENFORCEMENT:
 * DELIVERED status CANNOT be set via this endpoint. Any attempt will be rejected with 400 HTTP error.
 * DELIVERED can ONLY be set via /confirm-delivery by scanning the QR code.
 */
app.get('/requests/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await prisma.statusEvent.findMany({
      where: { delivery_id: id },
      include: { actor: true },
      orderBy: { timestamp: 'asc' },
    });
    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

app.post('/requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, riderId } = req.body;

    if (!newStatus || !riderId) {
      return res.status(400).json({ error: 'Both newStatus and riderId are required' });
    }

    // MANDATORY CONSTRAINT RULE: Reject direct DELIVERED manual status updates
    if (newStatus === 'DELIVERED') {
      return res.status(400).json({
        error: 'Forbidden: DELIVERED status cannot be set manually. Proof of delivery requires a QR code scan via /confirm-delivery endpoint.',
      });
    }

    const currentDelivery = await prisma.deliveryRequest.findUnique({
      where: { id },
    });

    if (!currentDelivery) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    const previousStatus = currentDelivery.status;

    // Transactionally update status + StatusEvent log
    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRequest.update({
        where: { id },
        data: { status: newStatus },
        include: {
          retailer: true,
          assigned_rider: true,
          status_events: {
            orderBy: { timestamp: 'desc' },
            include: { actor: true },
          },
        },
      });

      await tx.statusEvent.create({
        data: {
          delivery_id: id,
          from_status: previousStatus,
          to_status: newStatus,
          actor_id: riderId,
          actor_role: 'rider',
          method: 'manual_update',
        },
      });

      return updated;
    });

    // Notify connected rooms
    io.to(`retailer_${updatedDelivery.retailer_id}`).emit('status_updated', updatedDelivery);
    io.to('dispatchers').emit('status_updated', updatedDelivery);
    io.to(`rider_${riderId}`).emit('status_updated', updatedDelivery);

    console.log(`[Status Updated Manual] ID: ${id} | ${previousStatus} -> ${newStatus}`);
    res.json(updatedDelivery);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

/**
 * POST /requests/:id/confirm-delivery
 * Rider scans QR code to confirm delivery.
 * Body: { scannedToken, riderId }
 * 
 * VALIDATION:
 * Checks scannedToken === delivery.qr_code_token.
 * If match: Sets status = DELIVERED, writes StatusEvent with method: 'qr_scan'.
 * If mismatch: Rejects with 400 error and does NOT modify delivery.
 */
app.post('/requests/:id/confirm-delivery', async (req, res) => {
  try {
    const { id } = req.params;
    const { scannedToken, riderId } = req.body;

    if (!scannedToken || !riderId) {
      return res.status(400).json({ error: 'Both scannedToken and riderId are required' });
    }

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id },
    });

    if (!delivery) {
      return res.status(404).json({ error: 'Delivery request not found' });
    }

    // Token Match Verification
    if (scannedToken.trim() !== delivery.qr_code_token.trim()) {
      console.warn(`[QR Scan Verification Failed] Token mismatch for delivery ${id}. Expected: ${delivery.qr_code_token}, Got: ${scannedToken}`);
      return res.status(400).json({
        error: 'Invalid QR Code Token! Verification failed — delivery status remains unchanged.',
      });
    }

    const previousStatus = delivery.status;

    // Transactionally finalize delivery & record QR proof of delivery log
    const updatedDelivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRequest.update({
        where: { id },
        data: { status: 'DELIVERED' },
        include: {
          retailer: true,
          assigned_rider: true,
          status_events: {
            orderBy: { timestamp: 'desc' },
            include: { actor: true },
          },
        },
      });

      await tx.statusEvent.create({
        data: {
          delivery_id: id,
          from_status: previousStatus,
          to_status: 'DELIVERED',
          actor_id: riderId,
          actor_role: 'rider',
          method: 'qr_scan', // Explicitly records that QR scan proof occurred
        },
      });

      return updated;
    });

    // Real-time notification to Retailer, Dispatcher, and Rider
    io.to(`retailer_${updatedDelivery.retailer_id}`).emit('status_updated', updatedDelivery);
    io.to('dispatchers').emit('status_updated', updatedDelivery);
    io.to(`rider_${riderId}`).emit('status_updated', updatedDelivery);

    console.log(`[Delivery Confirmed via QR Scan] ID: ${id} | Token Verified: ${scannedToken}`);
    res.json(updatedDelivery);
  } catch (error) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

// Start Express Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Dukatrack Backend running on http://localhost:${PORT}`);
  console.log(` Socket.io Server active`);
  console.log(`=======================================================`);
});
