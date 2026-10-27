import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthSession } from "../../auth/model/AuthSession";
import {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
} from "../api/billing";
import type { BillingStatus } from "../model/billing";
import "./BillingSection.css";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === "string" ? detail : error.message;
  }
  return error instanceof Error ? error.message : "The billing request failed.";
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function BillingSection() {
  const { accessToken } = useAuthSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const checkoutResult = new URLSearchParams(location.search).get("checkout");
    let active = true;

    const loadBilling = async () => {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        let current: BillingStatus | null = null;
        const attempts = checkoutResult === "success" ? 10 : 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          current = await getBillingStatus(accessToken);
          if (!active) return;
          setBilling(current);
          if (checkoutResult !== "success" || current.plan === "pro" || attempt === attempts - 1) {
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }

        if (!active) return;
        if (checkoutResult === "success") {
          setNotice(
            current?.plan === "pro"
              ? "Your Pro subscription is active."
              : "Checkout completed. Stripe has not confirmed the subscription yet. Refresh this page in a moment.",
          );
          navigate("/profile", { replace: true });
        } else if (checkoutResult === "cancelled") {
          setNotice("Checkout was canceled. You have not been charged.");
          navigate("/profile", { replace: true });
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadBilling();
    return () => {
      active = false;
    };
  }, [accessToken, location.search, navigate]);

  const handleCheckout = async () => {
    setError("");
    setNotice("");
    setIsOpeningCheckout(true);
    try {
      if (!accessToken) throw new Error("Please sign in again to manage your plan.");
      window.location.assign(await createCheckoutSession(accessToken));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setIsOpeningCheckout(false);
    }
  };

  const handlePortal = async () => {
    setError("");
    setNotice("");
    setIsOpeningPortal(true);
    try {
      if (!accessToken) throw new Error("Please sign in again to manage your plan.");
      window.location.assign(await createPortalSession(accessToken));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setIsOpeningPortal(false);
    }
  };

  const periodEnd = formatDate(billing?.current_period_end ?? null);

  return (
    <section className="billing-card" aria-labelledby="billing-title">
      <div className="billing-heading">
        <div>
          <h2 id="billing-title">Plan and billing</h2>
          <p>Choose a plan for your boards and invited collaborators.</p>
        </div>
        {billing && (
          <span className={`billing-plan-badge billing-plan-${billing.plan}`}>
            Current plan: {billing.plan === "pro" ? "Pro" : "Free"}
          </span>
        )}
      </div>

      {isLoading && <p className="billing-message">Loading plan…</p>}
      {error && <p className="billing-message billing-error" role="alert">{error}</p>}
      {notice && <p className="billing-message billing-success" role="status">{notice}</p>}

      {billing?.subscription_status === "past_due" && (
        <p className="billing-message billing-past-due" role="status">
          Stripe is retrying the payment. Pro access remains active during retries; update your payment method in billing settings.
        </p>
      )}
      {billing?.plan === "pro" && billing.cancel_at_period_end && periodEnd && (
        <p className="billing-message">
          Pro access is scheduled to end on {periodEnd}. Your boards and members will remain saved.
        </p>
      )}

      {billing && (
        <>
          <p className="billing-usage">
            Owned boards: {billing.owned_boards}{billing.max_owned_boards === null ? " (unlimited)" : ` / ${billing.max_owned_boards}`}
            <span>Invited people per board: up to {billing.max_invited_people_per_board}</span>
          </p>
          <div className="billing-plans">
            <article className={`billing-plan-card${billing.plan === "free" ? " is-current" : ""}`}>
              <h3>Free</h3>
              <p className="billing-price">$0 <span>/ month</span></p>
              <ul>
                <li>Up to 3 owned boards</li>
                <li>Up to 3 invited people per board</li>
                <li>Draw and save boards</li>
              </ul>
              {billing.plan === "free" && <span className="billing-current-label">Your current plan</span>}
            </article>

            <article className={`billing-plan-card${billing.plan === "pro" ? " is-current" : ""}`}>
              <h3>Pro</h3>
              <p className="billing-price">$9 <span>/ month · USD</span></p>
              <ul>
                <li>Unlimited owned boards</li>
                <li>Up to 15 invited people per board</li>
                <li>Draw and save boards</li>
              </ul>
              {billing.plan === "pro" ? (
                <span className="billing-current-label">Your current plan</span>
              ) : (
                <button type="button" onClick={() => void handleCheckout()} disabled={isLoading || isOpeningCheckout}>
                  {isOpeningCheckout ? "Opening checkout…" : "Upgrade to Pro"}
                </button>
              )}
            </article>
          </div>

          {billing.has_billing_account && (
            <button
              className="billing-portal-button"
              type="button"
              onClick={() => void handlePortal()}
              disabled={isLoading || isOpeningPortal}
            >
              {isOpeningPortal ? "Opening billing…" : "Manage billing"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
