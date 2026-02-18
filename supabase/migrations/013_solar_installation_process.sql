-- Seed: Solar Installation Process
-- 9-stage flowchart with decision branches for welcome call, change orders, and closeout

DO $$
DECLARE
  v_user_id       UUID;
  v_process_id    UUID;

  -- Main flow nodes
  n_start               UUID;
  n_sale_submission     UUID;
  n_intake              UUID;
  n_welcome_decision    UUID;
  n_site_survey         UUID;
  n_engineering         UUID;
  n_changes_decision    UUID;
  n_ntp_approval        UUID;
  n_permitting          UUID;
  n_pre_install         UUID;
  n_installation        UUID;
  n_closeout_decision   UUID;
  n_ahj                 UUID;
  n_funding             UUID;
  n_pto                 UUID;
  n_energized           UUID;
  n_in_service          UUID;
  n_end                 UUID;

  -- Decision branch nodes
  n_return_to_sales     UUID;
  n_change_order        UUID;
  n_followup            UUID;

BEGIN
  -- Use the first admin profile as the process owner
  SELECT id INTO v_user_id FROM profiles WHERE is_admin = TRUE LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM profiles LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No profiles found — cannot seed process without a user.';
  END IF;

  -- ──────────────────────────────────────────────
  -- Create Process
  -- ──────────────────────────────────────────────
  INSERT INTO processes (name, description, created_by)
  VALUES (
    'Solar Installation Process',
    'End-to-end process for residential solar installation — from sale submission through system energization and ongoing service.',
    v_user_id
  )
  RETURNING id INTO v_process_id;

  -- ──────────────────────────────────────────────
  -- Main Flow Nodes  (x = 400, y increments of 160)
  -- ──────────────────────────────────────────────

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (v_process_id, 'start', 'Sale Submission', null, 400, 50)
  RETURNING id INTO n_start;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Sale Submission',
    'Owner: Sales — All contracts, signatures, and required documents completed. Customer account automatically created in Podio. Homeowner receives access to the customer portal with next-step overview.',
    400, 210
  )
  RETURNING id INTO n_sale_submission;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Intake',
    'Owner: Customer Care — Welcome call attempted. Site Survey scheduled and date communicated to Site Survey team. Key project notes documented in Podio. All required documents reviewed. Financing portal verified to match signed agreement. Project details uploaded to Podio and Google Drive.',
    400, 370
  )
  RETURNING id INTO n_intake;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'decision',
    'Welcome Call Completed?',
    'If not completed, return to Sales for support. Customer Care continues call attempts with homeowner.',
    400, 530
  )
  RETURNING id INTO n_welcome_decision;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Site Survey',
    'Owner: Customer Care — Site Survey scheduled and completed. Incomplete or missed surveys tracked; Customer Care follows up with subcontractor to reschedule.',
    400, 690
  )
  RETURNING id INTO n_site_survey;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Engineering & Design',
    'Owner: Design, Engineering, Finance — Site Survey reviewed (pass/fail). Planset created and validated against signed proposal. Quality control review completed. Bill of Materials (BOM) created. Scope of Work (SOW) created and approved by Sales. Design layout shared with homeowner.',
    400, 850
  )
  RETURNING id INTO n_engineering;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'decision',
    'Changes Required?',
    'If changes are required, a Change Order is routed to Sales before proceeding.',
    400, 1010
  )
  RETURNING id INTO n_changes_decision;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'approval',
    'Finance NTP Approval',
    'Owner: Finance — Design submitted to Finance for Notice to Proceed (NTP). Approved plans forwarded to Permitting and Utility teams. Project Management team tracks customer approval.',
    400, 1170
  )
  RETURNING id INTO n_ntp_approval;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Permitting & Utility',
    'Owner: Permitting, Field Operations — Permit application submitted and approved. Utility application submitted and approved. HOA application submitted if applicable.',
    400, 1330
  )
  RETURNING id INTO n_permitting;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Pre-Install Preparation',
    'Owner: Project Management, Field Operations — Final design verified against NTP approval. Equipment confirmed and procurement initiated. Installation scheduled and confirmed with homeowner. Subcontractor confirms install date and plans. Pipeline or confirmation calls completed as needed.',
    400, 1490
  )
  RETURNING id INTO n_pre_install;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Installation',
    'Owner: Project Management, Field Operations — Installation crew completes required fieldwork. Homeowner contacted to confirm installation satisfaction. AHJ inspection completed when applicable. Monitoring account created in SolarEdge. Ensure system is not left energized prematurely.',
    400, 1650
  )
  RETURNING id INTO n_installation;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'decision',
    'Closeout Call Completed?',
    'If closeout call not completed, follow-up is initiated.',
    400, 1810
  )
  RETURNING id INTO n_closeout_decision;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'Submit for Funding',
    'Owner: Finance Ops, Field Operations — Finance submits funding package for installation payment. Finance coordinates with Field Operations on any payment rejections. Finance approval obtained. Installation funds received.',
    400, 1970
  )
  RETURNING id INTO n_funding;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'approval',
    'Final Approval & PTO',
    'Owner: Permitting, Project Management, Field Operations, Finance — Utility completion packet submitted. PTO received and documented. PTO submitted to Finance. Final (M3) payment submitted to financing partner.',
    400, 2130
  )
  RETURNING id INTO n_pto;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'System Energized',
    'Owner: Project Management — System energized. Monitoring verifies expected production. Monitoring access shared with homeowner.',
    400, 2290
  )
  RETURNING id INTO n_energized;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'task',
    'In Service',
    'Owner: Project Management, Customer Service — Service issues reported and triaged. Ownership clarified between Customer Service and subcontractors. Financing escalations managed. Customer referrals encouraged. Review requests sent. Customer portal remains active for ongoing support.',
    400, 2450
  )
  RETURNING id INTO n_in_service;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (v_process_id, 'end', 'Complete', null, 400, 2610)
  RETURNING id INTO n_end;

  -- ──────────────────────────────────────────────
  -- Decision Branch Nodes  (x = 720)
  -- ──────────────────────────────────────────────

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'notification',
    'Return to Sales for Support',
    'Owner: Customer Care — Customer Care notifies Sales and continues call attempts with homeowner to complete the welcome call.',
    720, 530
  )
  RETURNING id INTO n_return_to_sales;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'document',
    'Change Order to Sales',
    'Owner: Engineering — Change Order created and routed to Sales for approval before returning to design for revision.',
    720, 1010
  )
  RETURNING id INTO n_change_order;

  INSERT INTO process_nodes (process_id, node_type, label, description, x_position, y_position)
  VALUES (
    v_process_id, 'notification',
    'Closeout Follow-Up',
    'Owner: Project Management — Follow-up initiated with homeowner to complete closeout call.',
    720, 1810
  )
  RETURNING id INTO n_followup;

  -- ──────────────────────────────────────────────
  -- Edges — Main Flow
  -- ──────────────────────────────────────────────

  INSERT INTO process_edges (process_id, source_node_id, target_node_id, label) VALUES
    (v_process_id, n_start,             n_sale_submission,  null),
    (v_process_id, n_sale_submission,   n_intake,           null),
    (v_process_id, n_intake,            n_welcome_decision, null),
    (v_process_id, n_welcome_decision,  n_site_survey,      'Completed'),
    (v_process_id, n_site_survey,       n_engineering,      null),
    (v_process_id, n_engineering,       n_changes_decision, null),
    (v_process_id, n_changes_decision,  n_ntp_approval,     'No Changes'),
    (v_process_id, n_ntp_approval,      n_permitting,       null),
    (v_process_id, n_permitting,        n_pre_install,      null),
    (v_process_id, n_pre_install,       n_installation,     null),
    (v_process_id, n_installation,      n_closeout_decision,null),
    (v_process_id, n_closeout_decision, n_funding,          'Completed'),
    (v_process_id, n_funding,           n_pto,              null),
    (v_process_id, n_pto,               n_energized,        null),
    (v_process_id, n_energized,         n_in_service,       null),
    (v_process_id, n_in_service,        n_end,              null);

  -- ──────────────────────────────────────────────
  -- Edges — Decision Branches
  -- ──────────────────────────────────────────────

  INSERT INTO process_edges (process_id, source_node_id, target_node_id, label) VALUES
    -- Welcome call branch
    (v_process_id, n_welcome_decision, n_return_to_sales, 'Not Completed'),
    (v_process_id, n_return_to_sales,  n_intake,          'Retry'),

    -- Change order branch
    (v_process_id, n_changes_decision, n_change_order,    'Changes Required'),
    (v_process_id, n_change_order,     n_engineering,     'Revise'),

    -- Closeout follow-up branch
    (v_process_id, n_closeout_decision, n_followup,        'Not Completed'),
    (v_process_id, n_followup,          n_closeout_decision,'Retry');

END $$;
