import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const staffRoles = new Set([
  'consulting',
  'nurse',
  'labs',
  'pharmacy',
  'reception',
  'cashier',
  'billing_claims',
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function response(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requiredText(value, label, maxLength) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new HttpError(400, `${label} must be between 1 and ${maxLength} characters.`);
  }

  return trimmed;
}

function validateRole(value) {
  if (!staffRoles.has(value)) {
    throw new HttpError(400, 'Choose a valid staff role.');
  }
  return value;
}

function mapStaffProfile(profile) {
  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    hospital_id: profile.hospital_id,
    created_at: profile.created_at,
  };
}

async function getStaffProfile(adminClient, staffId, hospitalId, callerId) {
  if (typeof staffId !== 'string' || !staffId) {
    throw new HttpError(400, 'Staff account ID is required.');
  }
  if (staffId === callerId) {
    throw new HttpError(400, 'Manage your own account from Profile and Settings.');
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, email, phone, role, hospital_id, created_at')
    .eq('id', staffId)
    .eq('hospital_id', hospitalId)
    .in('role', [...staffRoles])
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Could not load staff account: ${error.message}`);
  }
  if (!data) {
    throw new HttpError(404, 'Staff account not found in your hospital.');
  }

  return data;
}

async function handleList(adminClient, hospitalId, callerId) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, email, phone, role, hospital_id, created_at')
    .eq('hospital_id', hospitalId)
    .in('role', [...staffRoles])
    .neq('id', callerId)
    .order('full_name', { ascending: true });

  if (error) {
    throw new HttpError(500, `Could not load staff: ${error.message}`);
  }

  return { staff: (data || []).map(mapStaffProfile) };
}

async function handleCreate(adminClient, hospitalId, payload) {
  const fullName = requiredText(payload.full_name, 'Name', 120);
  const email = requiredText(payload.email, 'Email', 254).toLowerCase();
  const role = validateRole(payload.role);
  if (typeof payload.password !== 'string') {
    throw new HttpError(400, 'Password is required.');
  }
  const password = payload.password;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be between 8 and 128 characters.');
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    throw new HttpError(400, `Could not create staff account: ${error.message}`);
  }
  if (!data.user) {
    throw new HttpError(500, 'Staff account creation returned no user.');
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      phone: 'Not provided',
      role,
      hospital_id: hospitalId,
    })
    .eq('id', data.user.id)
    .is('hospital_id', null)
    .select('id, full_name, email, phone, role, hospital_id, created_at')
    .maybeSingle();

  if (profileError || !profile) {
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(data.user.id);
    if (rollbackError) {
      throw new HttpError(
        500,
        `The staff account was created but hospital assignment failed (${profileError?.message || 'profile not found'}). Automatic cleanup failed: ${rollbackError.message}`,
      );
    }
    throw new HttpError(
      500,
      `Could not assign the new account to this hospital: ${profileError?.message || 'account profile not found'}. The incomplete account was removed.`,
    );
  }

  return { staff: mapStaffProfile(profile) };
}

async function handleRead(adminClient, hospitalId, callerId, payload) {
  const profile = await getStaffProfile(
    adminClient,
    payload.staff_id,
    hospitalId,
    callerId,
  );
  return { staff: mapStaffProfile(profile) };
}

async function handleUpdate(adminClient, hospitalId, callerId, payload) {
  const staff = await getStaffProfile(
    adminClient,
    payload.staff_id,
    hospitalId,
    callerId,
  );

  const fullName = requiredText(payload.full_name, 'Name', 120);
  const email = requiredText(payload.email, 'Email', 254).toLowerCase();
  const role = validateRole(payload.role);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }

  if (typeof payload.password === 'string' && payload.password.length > 0 && payload.password.length < 8) {
    throw new HttpError(400, 'Password must contain at least 8 characters.');
  }
  if (typeof payload.password === 'string' && payload.password.length > 128) {
    throw new HttpError(400, 'Password must be 128 characters or fewer.');
  }

  const { data: authResult, error: authError } =
    await adminClient.auth.admin.getUserById(staff.id);
  if (authError || !authResult.user) {
    throw new HttpError(
      500,
      `Could not load staff authentication details: ${authError?.message || 'user not found'}`,
    );
  }

  const previousUser = authResult.user;
  const authUpdates = {
    email,
    email_confirm: true,
    user_metadata: {
      ...previousUser.user_metadata,
      full_name: fullName,
    },
  };
  if (typeof payload.password === 'string' && payload.password.length > 0) {
    authUpdates.password = payload.password;
  }

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
    staff.id,
    authUpdates,
  );
  if (updateAuthError) {
    throw new HttpError(
      400,
      `Could not update staff sign-in details: ${updateAuthError.message}`,
    );
  }

  const { data: updatedProfile, error: profileError } = await adminClient
    .from('profiles')
    .update({ full_name: fullName, email, role })
    .eq('id', staff.id)
    .eq('hospital_id', hospitalId)
    .select('id, full_name, email, phone, role, hospital_id, created_at')
    .maybeSingle();

  if (profileError || !updatedProfile) {
    const { error: rollbackError } =
      await adminClient.auth.admin.updateUserById(staff.id, {
        email: previousUser.email,
        email_confirm: true,
        user_metadata: previousUser.user_metadata,
      });

    if (rollbackError) {
      throw new HttpError(
        500,
        `The profile update failed (${profileError?.message || 'staff record not found'}) and sign-in detail rollback also failed: ${rollbackError.message}`,
      );
    }
    throw new HttpError(
      500,
      `Could not update the staff profile: ${profileError?.message || 'staff record not found'}. Sign-in details were restored.`,
    );
  }

  return { staff: mapStaffProfile(updatedProfile) };
}

async function handleDelete(adminClient, hospitalId, callerId, payload) {
  const staff = await getStaffProfile(
    adminClient,
    payload.staff_id,
    hospitalId,
    callerId,
  );
  const { error } = await adminClient.auth.admin.deleteUser(staff.id);
  if (error) {
    throw new HttpError(500, `Could not delete staff account: ${error.message}`);
  }
  return { deleted_id: staff.id };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return response(405, { error: 'Method not allowed.' });
  }

  try {
    const authorization = request.headers.get('Authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      throw new HttpError(401, 'Sign in to manage staff.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new HttpError(500, 'Staff management is not configured on the server.');
    }

    const identityClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: identityError,
    } = await identityClient.auth.getUser(accessToken);
    if (identityError || !user) {
      throw new HttpError(401, 'Your session is invalid or expired. Sign in again.');
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, role, hospital_id')
      .eq('id', user.id)
      .maybeSingle();

    if (callerProfileError) {
      throw new HttpError(500, `Could not verify hospital administrator: ${callerProfileError.message}`);
    }
    if (callerProfile?.role !== 'hospitaladmin' || !callerProfile.hospital_id) {
      throw new HttpError(403, 'Only a hospital administrator can manage staff.');
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError(400, 'Request body must contain valid JSON.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, 'Request body must be a JSON object.');
    }

    let result;
    switch (payload.action) {
      case 'list':
        result = await handleList(adminClient, callerProfile.hospital_id, user.id);
        break;
      case 'create':
        result = await handleCreate(adminClient, callerProfile.hospital_id, payload);
        break;
      case 'read':
        result = await handleRead(
          adminClient,
          callerProfile.hospital_id,
          user.id,
          payload,
        );
        break;
      case 'update':
        result = await handleUpdate(
          adminClient,
          callerProfile.hospital_id,
          user.id,
          payload,
        );
        break;
      case 'delete':
        result = await handleDelete(
          adminClient,
          callerProfile.hospital_id,
          user.id,
          payload,
        );
        break;
      default:
        throw new HttpError(400, 'Choose a supported staff action.');
    }

    return response(200, result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Staff management failed unexpectedly.';

    return response(status, { error: message });
  }
});
