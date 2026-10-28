const pool = require('../config/db');

const VALID_STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected', 'Ghosted'];

/**
 * Validate date string (accepts YYYY-MM-DD or standard parseable ISO dates)
 */
function isValidDate(dateString) {
  if (!dateString) return false;
  const timestamp = Date.parse(dateString);
  return !isNaN(timestamp);
}

/**
 * Format date to YYYY-MM-DD string for MySQL DATE columns
 */
function formatDateForDB(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Create a new job application
 * POST /api/applications
 */
async function createApplication(req, res) {
  try {
    const userId = req.user.id;
    const { company, role, link, status, applied_date, interview_date, notes } = req.body;

    // Validate required fields
    if (!company || typeof company !== 'string' || !company.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ error: 'Job role is required' });
    }
    if (!applied_date || !isValidDate(applied_date)) {
      return res.status(400).json({ error: 'A valid applied date is required (YYYY-MM-DD)' });
    }

    const trimmedCompany = company.trim();
    const trimmedRole = role.trim();

    if (trimmedCompany.length > 100) {
      return res.status(400).json({ error: 'Company name cannot exceed 100 characters' });
    }
    if (trimmedRole.length > 100) {
      return res.status(400).json({ error: 'Role title cannot exceed 100 characters' });
    }

    // Validate status
    const appStatus = status || 'Applied';
    if (!VALID_STATUSES.includes(appStatus)) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Validate optional link
    let sanitizedLink = null;
    if (link !== undefined && link !== null && String(link).trim()) {
      const linkStr = String(link).trim();
      if (linkStr.length > 2083) {
        return res.status(400).json({ error: 'Job link cannot exceed 2083 characters' });
      }
      sanitizedLink = linkStr;
    }

    // Validate optional interview_date
    let formattedInterviewDate = null;
    if (interview_date) {
      if (!isValidDate(interview_date)) {
        return res.status(400).json({ error: 'Invalid interview date format' });
      }
      formattedInterviewDate = formatDateForDB(interview_date);
    }

    const formattedAppliedDate = formatDateForDB(applied_date);
    const sanitizedNotes = notes !== undefined && notes !== null ? String(notes).trim() : null;

    // Insert into database with parameterized query
    const [result] = await pool.execute(
      `INSERT INTO applications 
        (user_id, company, role, link, status, applied_date, interview_date, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        trimmedCompany,
        trimmedRole,
        sanitizedLink,
        appStatus,
        formattedAppliedDate,
        formattedInterviewDate,
        sanitizedNotes,
      ]
    );

    const newId = result.insertId;

    // Retrieve the created record
    const [rows] = await pool.execute(
      'SELECT * FROM applications WHERE id = ? AND user_id = ?',
      [newId, userId]
    );

    return res.status(201).json({
      message: 'Job application created successfully',
      application: rows[0],
    });
  } catch (error) {
    console.error('Error creating job application:', error);
    return res.status(500).json({ error: 'Internal server error creating application' });
  }
}

/**
 * Get all job applications for the logged-in user
 * GET /api/applications
 */
async function getAllApplications(req, res) {
  try {
    const userId = req.user.id;
    const { status, search, sort } = req.query;

    let query = 'SELECT * FROM applications WHERE user_id = ?';
    const params = [userId];

    // Filter by status
    if (status && VALID_STATUSES.includes(status)) {
      query += ' AND status = ?';
      params.push(status);
    }

    // Filter by search keyword (company or role)
    if (search && typeof search === 'string' && search.trim()) {
      query += ' AND (company LIKE ? OR role LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    // Sorting options
    let orderByClause = ' ORDER BY applied_date DESC, id DESC';
    if (sort === 'applied_asc') {
      orderByClause = ' ORDER BY applied_date ASC, id ASC';
    } else if (sort === 'company_asc') {
      orderByClause = ' ORDER BY company ASC';
    } else if (sort === 'company_desc') {
      orderByClause = ' ORDER BY company DESC';
    } else if (sort === 'status_asc') {
      orderByClause = ' ORDER BY status ASC, applied_date DESC';
    }

    query += orderByClause;

    const [applications] = await pool.execute(query, params);

    return res.status(200).json({
      total: applications.length,
      applications,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({ error: 'Internal server error fetching applications' });
  }
}

/**
 * Get a specific application by ID (scoped to the authenticated user)
 * GET /api/applications/:id
 */
async function getApplicationById(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = parseInt(req.params.id, 10);

    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const [applications] = await pool.execute(
      'SELECT * FROM applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (applications.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.status(200).json({
      application: applications[0],
    });
  } catch (error) {
    console.error('Error retrieving application:', error);
    return res.status(500).json({ error: 'Internal server error retrieving application' });
  }
}

/**
 * Update an existing application (scoped to authenticated user)
 * PUT /api/applications/:id
 */
async function updateApplication(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = parseInt(req.params.id, 10);

    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    // First check that application exists and belongs to current user
    const [existing] = await pool.execute(
      'SELECT * FROM applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const current = existing[0];
    const { company, role, link, status, applied_date, interview_date, notes } = req.body;

    const updates = [];
    const params = [];

    if (company !== undefined) {
      if (typeof company !== 'string' || !company.trim()) {
        return res.status(400).json({ error: 'Company name cannot be empty' });
      }
      if (company.trim().length > 100) {
        return res.status(400).json({ error: 'Company name cannot exceed 100 characters' });
      }
      updates.push('company = ?');
      params.push(company.trim());
    }

    if (role !== undefined) {
      if (typeof role !== 'string' || !role.trim()) {
        return res.status(400).json({ error: 'Role title cannot be empty' });
      }
      if (role.trim().length > 100) {
        return res.status(400).json({ error: 'Role title cannot exceed 100 characters' });
      }
      updates.push('role = ?');
      params.push(role.trim());
    }

    if (link !== undefined) {
      if (link === null || link === '') {
        updates.push('link = ?');
        params.push(null);
      } else {
        const linkStr = String(link).trim();
        if (linkStr.length > 2083) {
          return res.status(400).json({ error: 'Job link cannot exceed 2083 characters' });
        }
        updates.push('link = ?');
        params.push(linkStr);
      }
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`,
        });
      }
      updates.push('status = ?');
      params.push(status);
    }

    if (applied_date !== undefined) {
      if (!isValidDate(applied_date)) {
        return res.status(400).json({ error: 'Invalid applied date format' });
      }
      updates.push('applied_date = ?');
      params.push(formatDateForDB(applied_date));
    }

    if (interview_date !== undefined) {
      if (interview_date === null || interview_date === '') {
        updates.push('interview_date = ?');
        params.push(null);
      } else {
        if (!isValidDate(interview_date)) {
          return res.status(400).json({ error: 'Invalid interview date format' });
        }
        updates.push('interview_date = ?');
        params.push(formatDateForDB(interview_date));
      }
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes !== null ? String(notes).trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    // Execute update query
    params.push(applicationId, userId);
    await pool.execute(
      `UPDATE applications SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    // Fetch updated record
    const [updatedRows] = await pool.execute(
      'SELECT * FROM applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    return res.status(200).json({
      message: 'Application updated successfully',
      application: updatedRows[0],
    });
  } catch (error) {
    console.error('Error updating application:', error);
    return res.status(500).json({ error: 'Internal server error updating application' });
  }
}

/**
 * Delete an application (scoped to authenticated user)
 * DELETE /api/applications/:id
 */
async function deleteApplication(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = parseInt(req.params.id, 10);

    if (isNaN(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const [result] = await pool.execute(
      'DELETE FROM applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.status(200).json({
      message: 'Application deleted successfully',
      id: applicationId,
    });
  } catch (error) {
    console.error('Error deleting application:', error);
    return res.status(500).json({ error: 'Internal server error deleting application' });
  }
}

module.exports = {
  createApplication,
  getAllApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
};
