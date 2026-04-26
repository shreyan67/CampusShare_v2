require('dotenv').config()
const bcrypt = require('bcryptjs')
const { query, queryOne } = require('../db/pool')
const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function storeOtp(userId, otp) {
  await query('UPDATE otps SET used=TRUE WHERE user_id=$1 AND used=FALSE', [userId])
  const hash = await bcrypt.hash(otp, 8)
  const expiresAt = new Date(
    Date.now() + parseInt(process.env.OTP_EXPIRY_SECONDS || '300') * 1000
  )
  await query(
    'INSERT INTO otps(user_id,code_hash,expires_at) VALUES($1,$2,$3)',
    [userId, hash, expiresAt]
  )
}

async function verifyOtp(userId, otp) {
  const rec = await queryOne(
    'SELECT * FROM otps WHERE user_id=$1 AND used=FALSE AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1',
    [userId]
  )
  if (!rec) return false
  const ok = await bcrypt.compare(otp, rec.code_hash)
  if (!ok) return false
  await query('UPDATE otps SET used=TRUE WHERE id=$1', [rec.id])
  return true
}

async function sendOtpEmail(email, name, otp) {
  // Development mode — log to console, show on screen
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📩 DEV MODE — OTP for ${email} = ${otp}`)
    return { devOtp: otp }
  }

  // Production — send real email via Resend
  try {
    await resend.emails.send({
      from: 'CampusShare <noreply@campusshare.co.in>',
      to: email,
      subject: `${otp} — Your CampusShare login code`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
          <div style="margin-bottom:28px">
            <span style="font-size:22px;font-weight:800;color:#1A3A5C">Campus</span><span style="font-size:22px;font-weight:800;color:#E94560">Share</span>
          </div>
          <h1 style="font-size:20px;font-weight:700;color:#1A1A2E;margin:0 0 8px">Your login code</h1>
          <p style="font-size:14px;color:#5A6475;margin:0 0 28px">Hi ${name || 'there'}, use this code to sign in to CampusShare. It expires in 5 minutes.</p>
          <div style="background:#F0F4F8;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
            <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#1A3A5C">${otp}</span>
          </div>
          <p style="font-size:13px;color:#5A6475;margin:0 0 6px">This code expires in <strong>5 minutes</strong>.</p>
          <p style="font-size:13px;color:#5A6475;margin:0">If you didn't request this, you can safely ignore this email.</p>
          <div style="margin-top:36px;padding-top:20px;border-top:1px solid #E2E8F0">
            <p style="font-size:12px;color:#A0AEC0;margin:0">© 2025 CampusShare · campusshare.co.in</p>
          </div>
        </div>
      `
    })
    console.log(`[OTP] Email sent to ${email}`)
    return { success: true }
  } catch (err) {
    console.error('[OTP] Email failed:', err.message)
    return { success: false, error: err.message }
  }
}

module.exports = { generateOtp, storeOtp, verifyOtp, sendOtpEmail }