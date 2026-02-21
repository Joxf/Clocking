const express = require('express');
const router = express.Router();
const { CareHome } = require('../models');
const { authMiddleware, requireRoles } = require('../middleware/auth');

// GET /api/care-homes - List care homes
router.get('/', authMiddleware, requireRoles('admin'), async (req, res) => {
  try {
    const careHomes = await CareHome.find({}).lean();
    res.json({ care_homes: careHomes });
  } catch (error) {
    console.error('List care homes error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// GET /api/care-homes/:care_home_id - Get care home details
router.get('/:care_home_id', authMiddleware, async (req, res) => {
  try {
    const careHome = await CareHome.findOne({ id: req.params.care_home_id }).lean();
    
    if (!careHome) {
      return res.status(404).json({ detail: 'Care home not found' });
    }
    
    res.json(careHome);
  } catch (error) {
    console.error('Get care home error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
