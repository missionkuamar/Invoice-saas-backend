// backend/src/controllers/authController.js
// backend/src/controllers/authController.js
import User from '../models/User.js';
import Affiliate from '../models/Affiliate.js';
import AffiliateReferral from '../models/AffiliateReferral.js'; // ✅ ADD THIS IMPORT
import jwt from 'jsonwebtoken';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userData = user.toObject();
    delete userData.password;

    // Send response with role
    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        isActive: user.isActive,
        subscription: user.subscription,
        company: user.company,
        token,
      },
    });
  } catch (error) {
    //console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




// backend/src/controllers/authController.js - Register function

export const register = async (req, res) => {
  try {
    const { name, email, password, ref } = req.body;

    // console.log('📝 Register request:', { 
    //   email, 
    //   ref: ref || 'none', 
    //   hasRef: !!ref,
    //   body: req.body,
    //   query: req.query,
    //   headers: {
    //     referer: req.headers.referer,
    //     userAgent: req.headers['user-agent']
    //   }
    // });

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
      isActive: true,
      subscription: {
        plan: 'free',
        status: 'inactive',
      },
    });

 //   console.log(`✅ User registered: ${email} (ID: ${user._id})`);

    // ============ AFFILIATE TRACKING - ULTIMATE FIX ============
    let affiliateReferral = null;
    let affiliateCode = ref || '';

    // ✅ 1. Check session first (from clicking affiliate link)
    if (req.session?.affiliateReferral) {
      const { referralId, affiliateId } = req.session.affiliateReferral;
      
    //  console.log('📝 Session found:', { referralId, affiliateId });

      const referral = await AffiliateReferral.findById(referralId);
      if (referral) {
        referral.referredUser = user._id;
        referral.status = 'registered';
        await referral.save();

        const affiliate = await Affiliate.findById(affiliateId);
        if (affiliate) {
          affiliate.totalReferrals += 1;
          await affiliate.save();
         // console.log(`✅ Session referral linked: ${affiliate.affiliateCode}`);
        }

        affiliateReferral = referral;
        delete req.session.affiliateReferral;
        await req.session.save();
      }
    }

    // ✅ 2. Check ref from body
    if (ref && !affiliateReferral) {
    //  console.log('📝 Ref from body:', ref);
      const affiliate = await Affiliate.findOne({ 
        affiliateCode: ref,
        status: 'active' 
      });
      
      if (affiliate) {
        const newReferral = await AffiliateReferral.create({
          affiliate: affiliate._id,
          referredUser: user._id,
          status: 'registered',
        });
        
        affiliate.totalReferrals += 1;
        await affiliate.save();
        affiliateReferral = newReferral;
       // console.log(`✅ Ref from body linked: ${ref}`);
      }
    }

    // ✅ 3. Check ref from query (URL parameter)
    if (req.query.ref && !affiliateReferral) {
      const queryRef = req.query.ref;
     // console.log('📝 Ref from query:', queryRef);
      
      const affiliate = await Affiliate.findOne({ 
        affiliateCode: queryRef,
        status: 'active' 
      });
      
      if (affiliate) {
        const newReferral = await AffiliateReferral.create({
          affiliate: affiliate._id,
          referredUser: user._id,
          status: 'registered',
        });
        
        affiliate.totalReferrals += 1;
        await affiliate.save();
        affiliateReferral = newReferral;
       // console.log(`✅ Ref from query linked: ${queryRef}`);
      }
    }

    // ✅ 4. ULTIMATE FIX - Check referer header (if user came from affiliate link)
    if (!affiliateReferral) {
      const referer = req.headers.referer || '';
    //  console.log('📝 Checking referer:', referer);
      
      // Check if referer contains ref parameter
      if (referer.includes('ref=')) {
        const refMatch = referer.match(/ref=([^&]+)/);
        if (refMatch && refMatch[1]) {
          const refererRef = refMatch[1];
       //   console.log('📝 Ref from referer:', refererRef);
          
          const affiliate = await Affiliate.findOne({ 
            affiliateCode: refererRef,
            status: 'active' 
          });
          
          if (affiliate) {
            const newReferral = await AffiliateReferral.create({
              affiliate: affiliate._id,
              referredUser: user._id,
              status: 'registered',
            });
            
            affiliate.totalReferrals += 1;
            await affiliate.save();
            affiliateReferral = newReferral;
          //  console.log(`✅ Ref from referer linked: ${refererRef}`);
          }
        }
      }
    }

    // ✅ 5. LAST RESORT - Find existing referral without user
    if (!affiliateReferral) {
      // Find the most recent referral without a user (created when link was clicked)
      const pendingReferral = await AffiliateReferral.findOne({
        referredUser: null,
        status: 'clicked'
      }).sort({ createdAt: -1 });

      if (pendingReferral) {
        pendingReferral.referredUser = user._id;
        pendingReferral.status = 'registered';
        await pendingReferral.save();
        affiliateReferral = pendingReferral;
        //console.log(`✅ Pending referral linked: ${pendingReferral._id}`);
      }
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        subscription: user.subscription,
        token,
        affiliateReferral: affiliateReferral ? {
          id: affiliateReferral._id,
          affiliateCode: affiliateCode || 'pending',
          status: affiliateReferral.status,
        } : null,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
   // console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
export const updateProfile = async (req, res) => {
  try {
    const { name, company } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (name) user.name = name;
    if (company) user.company = company;

    user.updatedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        company: user.company,
      },
    });
  } catch (error) {
   // console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create admin user (Super Admin only)
// @route   POST /api/auth/create-admin
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, secretKey } = req.body;

    // Verify secret key
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Invalid secret key',
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Create admin user
    const user = await User.create({
      name,
      email,
      password,
      role: 'admin',
      isActive: true,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    //console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
export const getUsers = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    const users = await User.find().select('-password');
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
  //  console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/users/:id/role
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.',
      });
    }

    // Super admin check
    if (req.user.role === 'admin' && role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can assign super_admin role',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.role = role;
    user.updatedAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
 //   console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};