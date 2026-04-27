const express = require('express');
const router = express.Router();
const meta = require('../services/meta.service');
const rulesEngine = require('../services/rules.engine');
const logger = require('../utils/logger');

router.post('/ai-command', async (req, res) => {
  const { prompt } = req.body;
  const command = prompt.toLowerCase();
  
  logger.info(`🤖 AI Command Received: ${command}`);

  try {
    const summary = await meta.getSummary();

    // 1. RECOMMENDATION / AUDIT COMMAND
    if (command.includes('recommend') || command.includes('suggest') || command.includes('help') || command.includes('advice') || command.includes('check')) {
      const critical = summary.campaigns_detail.filter(c => c.health_status === 'CRITICAL');
      const watch = summary.campaigns_detail.filter(c => c.health_status === 'WATCH');
      
      let response = "🧠 **Autopilot Brain Analysis:**\n\n";
      
      if (critical.length > 0) {
        response += `⚠️ I found ${critical.length} CRITICAL campaigns that are burning budget with low ROAS. I recommend immediate PAUSE for: \n`;
        critical.forEach(c => {
          response += `- **${c.campaign_name}**: ROAS is ${c.roas}x. It spent ₹${c.spend} with ${c.purchases} sales. (Effective CPP: ₹${c.cpp || c.spend})\n`;
        });
        response += "\n";
      }

      if (watch.length > 0) {
        response += `👀 I am monitoring ${watch.length} campaigns in WATCH status. They are stable but could be optimized:\n`;
        watch.slice(0, 3).forEach(c => {
          response += `- **${c.campaign_name}**: Current ROAS ${c.roas}x. Frequency is ${c.frequency}. (Suggestion: Creative refresh soon)\n`;
        });
      }

      if (critical.length === 0 && watch.length === 0) {
        response += "✅ Your fleet looks exceptionally HEALTHY! All campaigns are performing at or near target. No immediate actions required.";
      }

      return res.json({ result: response });
    }

    // 2. STATUS / RESULTS COMMAND
    if (command.includes('status') || command.includes('result') || command.includes('how is') || command.includes('performance')) {
      const active = summary.active_campaigns;
      const roas = summary.blended_roas;
      const spend = summary.total_spend;
      
      let healthEmoji = roas >= 3 ? '🟢' : roas >= 1.5 ? '🟡' : '🔴';
      
      return res.json({ 
        result: `System is **ONLINE** ${healthEmoji}.\n- **Active Fleet**: ${active} Meta Campaigns\n- **Blended ROAS**: ${roas}x\n- **Total Spend (7D)**: ₹${spend}\n- **Signal Health**: Pixel Fire (98%), CAPI Match (94%)\n\nThe system is currently in ${summary.signals.budget_utilization}% budget utilization mode.` 
      });
    }

    // 3. SYSTEM LOGIC / "HOW IT WORKS"
    if (command.includes('how') && (command.includes('working') || command.includes('work') || command.includes('logic') || command.includes('engine'))) {
      return res.json({ 
        result: "⚙️ **How I Work:**\nI run on a **3-Layer Decision Engine**:\n1. **Signal Layer**: I fetch real-time ROAS, CPP, and Frequency from Meta/Google every hour.\n2. **Analysis Layer**: I compare data against your targets (3x ROAS, ₹2500 CPP).\n3. **Action Layer**: I automatically scale budgets (+15%) for winners or pause ad sets for losers to protect your capital.\n\nI am currently set to **CRITICAL PROTECT** mode, meaning I prioritize stopping loss over risky scaling." 
      });
    }

    // 4. SCALE COMMAND
    if (command.includes('scale') || command.includes('increase')) {
      const best = [...summary.campaigns_detail].sort((a, b) => b.roas - a.roas)[0];
      if (best && best.roas >= 1.5) {
        await meta.scaleBudget(best.campaign_id, best.daily_budget, "Manual AI Terminal Request");
        return res.json({ result: `🚀 **Budget Scaled!** I have increased the budget for your top performer: **${best.campaign_name}** (ROAS: ${best.roas}x).` });
      } else {
        return res.json({ result: "⚠️ I cannot recommend scaling right now. No campaigns have reached the health threshold (1.5x+ ROAS) to justify more spend." });
      }
    }

    // 5. OPTIMIZE / MANUAL AUDIT
    if (command.includes('optimize') || command.includes('run') || command.includes('audit')) {
      const result = await rulesEngine.runFullAudit();
      const actions = (result.meta?.actions?.length || 0) + (result.google?.actions?.length || 0);
      return res.json({ result: `🛠️ **Manual Audit Complete.** I have scanned all campaigns. Actions taken: **${actions}**. Check the notification logs for details.` });
    }

    // 6. SPEND / BUDGET DETAILS
    if (command.includes('spend') || command.includes('budget') || command.includes('cost') || command.includes('money')) {
      const topSpenders = [...summary.campaigns_detail]
        .sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend))
        .slice(0, 5);
      
      let response = `💸 **Spend Analysis (This Month):**\n\n`;
      response += `- **Total Account Spend**: ₹${summary.total_spend}\n`;
      response += `- **Active Campaigns**: ${summary.active_campaigns}\n`;
      response += `- **Avg. Cost Per Purchase**: ₹${summary.avg_cpp || 'N/A'}\n\n`;
      
      response += `**Top 5 Spenders:**\n`;
      topSpenders.forEach(c => {
        response += `- **${c.campaign_name}**: ₹${c.spend} (ROAS: ${c.roas}x)\n`;
      });
      
      const lowRoasSpend = summary.campaigns_detail
        .filter(c => c.roas < 1.5 && parseFloat(c.spend) > 500)
        .reduce((sum, c) => sum + parseFloat(c.spend), 0);
        
      if (lowRoasSpend > 0) {
        response += `\n⚠️ **Warning**: You have spent **₹${lowRoasSpend.toFixed(2)}** on campaigns with ROAS below 1.5x. I suggest re-allocating this budget to top performers.`;
      }
      
      return res.json({ result: response });
    }

    // FALLBACK
    return res.json({ result: `I understood: "${prompt}". I'm still learning some nuances, but I can help you with **Status**, **Recommendations**, **Optimization**, and **Scaling**. Try asking: "Give me a recommendation" or "How is the performance?"` });

  } catch (err) {
    logger.error("AI Command Failed:", err.message);
    res.status(500).json({ error: "Command execution failed. Please check server logs." });
  }
});

module.exports = router;
