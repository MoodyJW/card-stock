-- CardStock Seed Data
-- Run after schema migration to create test data

-- =============================================================================
-- TEST USER (jmoody1813@gmail.com)
-- =============================================================================
-- Note: This requires the user to already exist in auth.users
-- The handle_new_user trigger will auto-create their profile

-- Create test organization
INSERT INTO organizations (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Moody Cards', 'moody-cards');

-- =============================================================================
-- SAMPLE INVENTORY
-- =============================================================================

-- Note: After the test user registers, run this to add them as owner:
-- INSERT INTO memberships (user_id, organization_id, role, accepted_at)
-- SELECT id, '11111111-1111-1111-1111-111111111111', 'owner', now()
-- FROM auth.users WHERE email = 'jmoody1813@gmail.com';

-- Sample Pokémon cards (can be inserted after user is set up)
INSERT INTO inventory (
  id, organization_id, card_name, set_name, set_code, card_number, 
  rarity, condition, selling_price, status
) VALUES 
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Charizard', 'Base Set', 'BS', '4/102', 'Holo Rare', 'lightly_played', 249.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Pikachu', 'Base Set', 'BS', '58/102', 'Common', 'near_mint', 19.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Blastoise', 'Base Set', 'BS', '2/102', 'Holo Rare', 'near_mint', 179.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Venusaur', 'Base Set', 'BS', '15/102', 'Holo Rare', 'moderately_played', 129.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Mewtwo', 'Base Set', 'BS', '10/102', 'Holo Rare', 'near_mint', 89.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Gyarados', 'Base Set', 'BS', '6/102', 'Holo Rare', 'mint', 149.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Lugia', 'Neo Genesis', 'NG', '9/111', 'Holo Rare', 'near_mint', 199.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Umbreon', 'Neo Discovery', 'ND', '13/75', 'Holo Rare', 'lightly_played', 159.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Rayquaza VMAX', 'Evolving Skies', 'EVS', '218/203', 'Secret Rare', 'mint', 89.99, 'available'),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Pikachu VMAX', 'Vivid Voltage', 'VV', '188/185', 'Secret Rare', 'near_mint', 299.99, 'available');
