
"use client";

import { Header } from "@/components/layout/header";
import React from 'react';
import Link from "next/link";

export default function InvestmentPlansPage() {
    return (
        <div className="investment-plans-page">
            <style dangerouslySetInnerHTML={{ __html: `
                .investment-plans-page {
                    --gold: #d4af37;
                    --dark: #0f172a;
                    --dark2: #020617;
                    --gray: #94a3b8;
                    background: linear-gradient(180deg, var(--dark2), var(--dark));
                    color: #fff;
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                }
                
                .investment-plans-page .hero{
                    padding:80px 10%;
                    text-align:center;
                    background:radial-gradient(circle at top,rgba(212,175,55,0.15),transparent);
                }

                .investment-plans-page .hero h1{
                    font-size:48px;
                    color:var(--gold);
                    margin-bottom:15px;
                }

                .investment-plans-page .hero p{
                    max-width:900px;
                    margin:auto;
                    font-size:18px;
                    color:var(--gray);
                }

                .investment-plans-page .section{
                    padding:70px 10%;
                }

                .investment-plans-page .section h2{
                    text-align:center;
                    font-size:36px;
                    color:var(--gold);
                    margin-bottom:40px;
                }

                .investment-plans-page .cards{
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(280px,1fr));
                    gap:30px;
                }

                .investment-plans-page .card{
                    background:linear-gradient(180deg,#020617,#020617aa);
                    border:1px solid rgba(212,175,55,0.25);
                    border-radius:18px;
                    padding:30px;
                    position:relative;
                    overflow:hidden;
                    transition:0.4s;
                }

                .investment-plans-page .card::before{
                    content:"";
                    position:absolute;
                    inset:0;
                    background:linear-gradient(120deg,transparent,rgba(212,175,55,0.15),transparent);
                    opacity:0;
                    transition:0.4s;
                }

                .investment-plans-page .card:hover::before{
                    opacity:1;
                }

                .investment-plans-page .card:hover{
                    transform:translateY(-10px);
                    box-shadow:0 20px 40px rgba(212,175,55,0.25);
                }

                .investment-plans-page .card h3{
                    color:var(--gold);
                    margin-bottom:15px;
                    font-size:24px;
                }

                .investment-plans-page .card p{
                    color:var(--gray);
                    line-height:1.7;
                }

                .investment-plans-page .markets{
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
                    gap:25px;
                }

                .investment-plans-page .market{
                    padding:25px;
                    border-radius:16px;
                    background:rgba(255,255,255,0.03);
                    border:1px solid rgba(255,255,255,0.1);
                }

                .investment-plans-page .market h4{
                    color:var(--gold);
                    margin-bottom:10px;
                }

                .investment-plans-page .why{
                    display:grid;
                    grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
                    gap:25px;
                }

                .investment-plans-page .why div{
                    background:rgba(212,175,55,0.05);
                    border-left:4px solid var(--gold);
                    padding:25px;
                    border-radius:10px;
                }

                .investment-plans-page .cta{
                    text-align:center;
                    padding:80px 10%;
                    background:linear-gradient(180deg,transparent,rgba(212,175,55,0.15));
                }

                .investment-plans-page .cta h2{
                    font-size:38px;
                    margin-bottom:20px;
                    color:var(--gold);
                }

                .investment-plans-page .cta .custom-cta-button{
                    display: inline-block;
                    padding:15px 40px;
                    font-size:18px;
                    border:none;
                    border-radius:40px;
                    background:linear-gradient(90deg,var(--gold),#f5d76e);
                    color:#000;
                    cursor:pointer;
                    transition:0.3s;
                    text-decoration: none;
                }

                .investment-plans-page .cta .custom-cta-button:hover{
                    transform:scale(1.05);
                }
                
                @media (max-width:768px){
                    .investment-plans-page .hero{ padding:50px 6%; }
                    .investment-plans-page .hero h1{ font-size:32px; }
                    .investment-plans-page .hero p{ font-size:16px; }
                    .investment-plans-page .section{ padding:50px 6%; }
                    .investment-plans-page .section h2{ font-size:26px; margin-bottom:30px; }
                    .investment-plans-page .cards, .investment-plans-page .markets, .investment-plans-page .why{ grid-template-columns:1fr; }
                    .investment-plans-page .card{ padding:22px; }
                    .investment-plans-page .card h3{ font-size:20px; }
                    .investment-plans-page .cta{ padding:60px 6%; }
                    .investment-plans-page .cta h2{ font-size:28px; }
                    .investment-plans-page .cta .custom-cta-button{ width:100%; padding:16px; font-size:17px; }
                }
            ` }} />
            <Header />
            <main>
                <section className="hero">
                    <h1>Investment Plans</h1>
                    <p>
                        At <strong>NOBELINVES LTD</strong>, we offer sophisticated investment plans designed for discerning investors who seek professional management and strategic growth in high-volatility global markets.
                    </p>
                </section>

                <section className="section">
                    <h2>Our Core Services</h2>
                    <div className="cards">
                        <div className="card">
                            <h3>Fund Management</h3>
                            <p>
                                Our experienced team actively manages your portfolio using advanced analytics and market intelligence to optimize returns while maintaining diversification and long-term stability.
                            </p>
                        </div>

                        <div className="card">
                            <h3>Risk Management</h3>
                            <p>
                                We implement robust strategies including hedging, dynamic asset allocation, and real-time monitoring to protect capital while capturing market opportunities.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <h2>Markets We Focus On</h2>
                    <div className="markets">
                        <div className="market">
                            <h4>Gold & Silver</h4>
                            <p>Precious metals as a hedge against inflation and portfolio volatility.</p>
                        </div>
                        <div className="market">
                            <h4>Oil & Energy</h4>
                            <p>Strategic positioning based on global demand and market trends.</p>
                        </div>
                        <div className="market">
                            <h4>Stock Markets</h4>
                            <p>Carefully selected global equities balancing growth and risk.</p>
                        </div>
                    </div>
                </section>

                <section className="section">
                    <h2>Why Choose NOBELINVES LTD?</h2>
                    <div className="why">
                        <div>Professional fund management with expertise in volatile markets</div>
                        <div>Comprehensive risk management strategies to safeguard capital</div>
                        <div>Tailored investment plans based on individual goals</div>
                        <div>Transparent reporting and performance monitoring</div>
                    </div>
                </section>

                <section className="cta">
                    <h2>Start Your Investment Journey</h2>
                    <Link href="/signup" className="custom-cta-button">Request Investment Proposal</Link>
                </section>
            </main>
        </div>
    );
}
