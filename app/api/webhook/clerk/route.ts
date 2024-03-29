import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';

import updateUser from '@/sanity/lib/members/updateUser';
import deleteUser from '@/sanity/lib/members/deleteUser';
import handleUserRole from '@/sanity/lib/members/handleUserRole';
import { cancelSubscription } from '@/lib/actions/stripe.actions';
import { client } from '@/sanity/lib';
import { clerkClient } from '@clerk/nextjs';

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  // Get the ID and type
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, image_url, first_name, last_name, public_metadata } = evt.data;

    let user;

    if (public_metadata.role === 'member') {
      user = {
        clerkId: id,
        email: email_addresses[0].email_address,
        phone: public_metadata.phoneNumber,
        seller: public_metadata.seller,
        //  photo: image_url,
        firstName: first_name,
        lastName: last_name,
        disabled: false,

        role: public_metadata.role,
        companyName: public_metadata.companyName,
        siret: public_metadata.siret,
        address: public_metadata.address,
        subscription: public_metadata.subscription,
      };
    } else {
      user = {
        clerkId: id,
        role: public_metadata.role,
        email: email_addresses[0].email_address,
        phone: public_metadata.phoneNumber,
        //   photo: image_url,
        firstName: first_name,
        lastName: last_name,
      };
    }

    const newUser = await client.fetch(
      `*[_type == '${process.env.NEXT_PUBLIC_SANITY_SUBSCRIBERS}' && clerkId == $clerkId][0]`,
      { clerkId: id }
    );
    if (newUser) {
      await clerkClient.users.updateUserMetadata(id, {
        publicMetadata: {
          userId: newUser._id,
        },
      });
    }
    /*     const newUser: any = await createUser(user);

    if (newUser) {
      await clerkClient.users.updateUserMetadata(id, {
        publicMetadata: {
          userId: newUser._id,
        },
      });
    } */
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, image_url, first_name, last_name, public_metadata } = evt.data;

    let user: any;

    if (public_metadata.role === 'member') {
      user = {
        clerkId: id,
        email: email_addresses[0].email_address,
        phone: public_metadata.phoneNumber,
        // photo: image_url,
        firstName: first_name,
        lastName: last_name,

        role: public_metadata.role,
        companyName: public_metadata.companyName,
        siret: public_metadata.siret,
        address: public_metadata.address,
        subscription: public_metadata.subscription,
      };
    } else {
      user = {
        clerkId: id,
        role: public_metadata.role,
        email: email_addresses[0].email_address,
        phone: public_metadata.phoneNumber,
        //  photo: image_url,
        firstName: first_name,
        lastName: last_name,
      };
    }

    await updateUser({
      user,
      // @ts-ignore
      id: public_metadata?.userId,
    });
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;

    if (id) {
      await deleteUser({ id });
      await cancelSubscription({ clerkId: id });
    }
  }

  // Add user to organization
  if (eventType === 'organizationMembership.created') {
    const { id, role } = evt.data;

    await handleUserRole({ clerkId: id, role });
  }

  // Remove user from organization
  if (eventType === 'organizationMembership.deleted') {
    const { id } = evt.data;

    await handleUserRole({ clerkId: id, role: 'member' });
  }

  return new Response('', { status: 200 });
}
