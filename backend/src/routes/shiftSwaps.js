const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { ShiftSwapRequest, Shift, Employee, Notification } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/shift-swaps - Get shift swap requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = { care_home_id: req.user.care_home_id };
    
    if (!['manager', 'admin'].includes(req.user.role)) {
      query.$or = [
        { requester_id: req.user.id },
        { target_id: req.user.id },
        { swap_type: 'open', status: 'pending_acceptance' }
      ];
    }
    
    const requests = await ShiftSwapRequest.find(query).sort({ created_at: -1 }).lean();
    res.json({ requests });
  } catch (error) {
    console.error('Get shift swaps error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/shift-swaps - Create shift swap request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { original_shift_id, swap_type, target_id, reason, message_to_manager } = req.body;
    
    // Get the shift
    const shift = await Shift.findOne({ id: original_shift_id }).lean();
    if (!shift) {
      return res.status(404).json({ detail: 'Shift not found' });
    }
    
    // Get target employee name if direct swap
    let targetName = null;
    if (target_id) {
      const targetEmp = await Employee.findOne({ id: target_id }).lean();
      if (targetEmp) {
        targetName = `${targetEmp.first_name} ${targetEmp.last_name}`;
      }
    }
    
    const newSwap = await ShiftSwapRequest.create({
      requester_id: req.user.id,
      requester_name: `${req.user.first_name} ${req.user.last_name}`,
      target_id,
      target_name: targetName,
      original_shift_id,
      shift_date: shift.shift_date,
      shift_start: shift.start_time,
      shift_end: shift.end_time,
      reason,
      message_to_manager,
      swap_type: swap_type || 'open',
      care_home_id: req.user.care_home_id
    });
    
    // Notify target or managers
    if (target_id) {
      await Notification.create({
        care_home_id: req.user.care_home_id,
        recipient_id: target_id,
        title: 'Shift Swap Request',
        content: `${req.user.first_name} ${req.user.last_name} wants to swap shifts with you for ${shift.shift_date}`,
        notification_type: 'swap_request',
        related_id: newSwap.id
      });
    }
    
    res.json({ success: true, swap: newSwap });
  } catch (error) {
    console.error('Create shift swap error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/shift-swaps/:swap_id/accept - Accept shift swap
router.post('/:swap_id/accept', authMiddleware, async (req, res) => {
  try {
    const swap = await ShiftSwapRequest.findOne({
      id: req.params.swap_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!swap) {
      return res.status(404).json({ detail: 'Swap request not found' });
    }
    
    if (swap.status !== 'pending_acceptance') {
      return res.status(400).json({ detail: 'Swap is not pending acceptance' });
    }
    
    await ShiftSwapRequest.updateOne(
      { id: swap.id },
      { $set: {
        status: 'accepted_pending_approval',
        accepted_by: req.user.id,
        accepted_by_name: `${req.user.first_name} ${req.user.last_name}`
      }}
    );
    
    // Notify requester
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: swap.requester_id,
      title: 'Shift Swap Accepted',
      content: `${req.user.first_name} ${req.user.last_name} has accepted your swap request. Awaiting manager approval.`,
      notification_type: 'swap_accepted',
      related_id: swap.id
    });
    
    // Notify managers
    const managers = await Employee.find({
      care_home_id: req.user.care_home_id,
      role: 'manager',
      status: 'active'
    }).lean();
    
    for (const manager of managers) {
      await Notification.create({
        care_home_id: req.user.care_home_id,
        recipient_id: manager.id,
        title: 'Shift Swap Needs Approval',
        content: `A shift swap between ${swap.requester_name} and ${req.user.first_name} ${req.user.last_name} needs your approval`,
        notification_type: 'swap_needs_approval',
        related_id: swap.id
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Accept swap error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/shift-swaps/:swap_id/approve - Approve shift swap (manager)
router.post('/:swap_id/approve', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const swap = await ShiftSwapRequest.findOne({
      id: req.params.swap_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!swap) {
      return res.status(404).json({ detail: 'Swap request not found' });
    }
    
    if (swap.status !== 'accepted_pending_approval') {
      return res.status(400).json({ detail: 'Swap is not pending approval' });
    }
    
    // Update shift assignment
    await Shift.updateOne(
      { id: swap.original_shift_id },
      { $set: { employee_id: swap.accepted_by, status: 'swapped' } }
    );
    
    await ShiftSwapRequest.updateOne(
      { id: swap.id },
      { $set: {
        status: 'approved',
        manager_approved: true,
        approved_by: req.user.id,
        approved_at: new Date()
      }}
    );
    
    // Notify both employees
    for (const empId of [swap.requester_id, swap.accepted_by]) {
      await Notification.create({
        care_home_id: req.user.care_home_id,
        recipient_id: empId,
        title: 'Shift Swap Approved',
        content: `The shift swap for ${swap.shift_date} has been approved by management`,
        notification_type: 'swap_approved',
        related_id: swap.id
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Approve swap error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/shift-swaps/:swap_id/reject - Reject shift swap
router.post('/:swap_id/reject', authMiddleware, requireRoles('manager', 'admin'), async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    
    const swap = await ShiftSwapRequest.findOne({
      id: req.params.swap_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!swap) {
      return res.status(404).json({ detail: 'Swap request not found' });
    }
    
    await ShiftSwapRequest.updateOne(
      { id: swap.id },
      { $set: { status: 'rejected', rejection_reason } }
    );
    
    // Notify requester
    await Notification.create({
      care_home_id: req.user.care_home_id,
      recipient_id: swap.requester_id,
      title: 'Shift Swap Rejected',
      content: `Your shift swap request for ${swap.shift_date} has been rejected. ${rejection_reason || ''}`,
      notification_type: 'swap_rejected',
      related_id: swap.id
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reject swap error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// POST /api/shift-swaps/:swap_id/cancel - Cancel shift swap
router.post('/:swap_id/cancel', authMiddleware, async (req, res) => {
  try {
    const swap = await ShiftSwapRequest.findOne({
      id: req.params.swap_id,
      care_home_id: req.user.care_home_id
    }).lean();
    
    if (!swap) {
      return res.status(404).json({ detail: 'Swap request not found' });
    }
    
    // Only requester or manager can cancel
    if (swap.requester_id !== req.user.id && !['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ detail: 'Not authorized' });
    }
    
    await ShiftSwapRequest.updateOne(
      { id: swap.id },
      { $set: { status: 'cancelled' } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel swap error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
